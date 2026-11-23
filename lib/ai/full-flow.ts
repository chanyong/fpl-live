import type { AiClient } from "@/lib/ai/anthropic-client";
import { maxCostFullCallUsd, withinFullInputCeiling } from "@/lib/ai/budget";
import { AI_MODEL_ID, STALE_RUNNING_MS } from "@/lib/ai/config";
import { FullUnavailableError, type FullInput } from "@/lib/ai/full-input";
import { validateFullOutput, type FullAiResult } from "@/lib/ai/full-schema";
import { aiGate, logCode, runJobSpec, withPrevious, type AiOutcomeOf, type AiDeps } from "@/lib/ai/recommend";
import { AiStoreError, type AiStore, type JobKey, type StoredJob } from "@/lib/ai/store";
import type { Locale } from "@/lib/locale";

/**
 * "Full AI" mode flow (issue #85): the same gate, stored copy, one-job-per-key, reservation-before-call and
 * validation as the ranking mode (lib/ai/recommend.ts), with three differences:
 *   - the model chooses the plan, so the answer is checked against the FPL rules (full-schema.ts);
 *   - a wrong answer is retried once, then the rules engine's own best option is stored, marked not verified;
 *   - a larger reservation (`maxCostFullCallUsd`), used only for this mode. The monthly and daily caps are the same.
 * It never starts by itself: a person ticks the box and presses the button.
 */

export type FullDonePayload = {
  targetGw: number;
  generation: number;
  kind: "first" | "manual";
  completedAt: string | null;
  modelId: string;
  modelVersion: string;
  result: FullAiResult;
};

export type FullOutcome = AiOutcomeOf<FullDonePayload>;

function toFullDone(job: StoredJob, targetGw: number): FullDonePayload | null {
  if (job.status !== "done" || job.result === null || job.result === undefined) {
    return null;
  }
  return {
    targetGw,
    generation: job.generation,
    kind: job.kind,
    completedAt: job.completedAt,
    modelId: job.modelId,
    modelVersion: job.modelVersion,
    result: job.result as FullAiResult
  };
}

const inputHashOf = (job: StoredJob) =>
  typeof job.basis === "object" && job.basis !== null ? (job.basis as { inputHash?: unknown }).inputHash : undefined;

/** State of one key's full-AI answer for a status poll: reads only. */
export async function readFullAi(entryId: number, locale: Locale, deps: AiDeps): Promise<FullOutcome> {
  const gate = aiGate(entryId, deps);
  if (gate) return gate;
  const store = deps.store as AiStore;

  try {
    const targetGw = await deps.targetGw();
    if (targetGw === null) return { status: "failed", code: "fpl_unavailable" };
    const key: JobKey = { entryId, targetGw, locale };
    await store.sweepStale(key, new Date(deps.now() - STALE_RUNNING_MS).toISOString());
    const latest = await store.latest(key, "full");
    const done = latest.done ? toFullDone(latest.done, targetGw) : null;
    if (latest.running) return { status: "pending", ...withPrevious(done) };
    if (done) return { status: "done", value: done };
    if (latest.failed) return { status: "failed", code: latest.failed.failureCode ?? "failed" };
    return { status: "none" };
  } catch (error) {
    if (error instanceof AiStoreError) {
      logCode("read-full", `store_${error.operation}_${error.status}`);
      return { status: "failed", code: "store_unavailable" };
    }
    throw error;
  }
}

/**
 * POST: a stored answer of the same question is returned as it is (cost 0); otherwise one job is created with its
 * (larger) reservation and the call is scheduled. Nothing paid happens unless the reservation succeeded.
 */
export async function requestFullAi(request: { entryId: number; locale: Locale; regenerate: boolean }, deps: AiDeps): Promise<FullOutcome> {
  const { entryId, locale, regenerate } = request;
  const gate = aiGate(entryId, deps);
  if (gate) return gate;
  if (!deps.loadFullInput) return { status: "failed", code: "full_unsupported" };
  const store = deps.store as AiStore;
  const client = deps.client as AiClient;

  try {
    const knownGw = await deps.targetGw();
    if (knownGw === null) return { status: "failed", code: "fpl_unavailable" };
    await store.sweepStale({ entryId, targetGw: knownGw, locale }, new Date(deps.now() - STALE_RUNNING_MS).toISOString());
    const first = await store.latest({ entryId, targetGw: knownGw, locale }, "full");
    const firstDone = first.done ? toFullDone(first.done, knownGw) : null;
    if (first.running) return { status: "pending", ...withPrevious(firstDone) };
    if (firstDone && !regenerate) return { status: "done", value: firstDone };

    let input: FullInput;
    try {
      input = await deps.loadFullInput(entryId, locale);
    } catch (error) {
      if (error instanceof FullUnavailableError) return { status: "failed", code: error.code };
      throw error;
    }
    // The table is rebuilt when a deadline passes: use the gameweek the input was really built for.
    const key: JobKey = { entryId, targetGw: input.basis.targetGw, locale };
    const latest = key.targetGw === knownGw ? first : await store.latest(key, "full");
    const done = latest.done ? toFullDone(latest.done, key.targetGw) : null;
    if (latest.running) return { status: "pending", ...withPrevious(done) };
    if (done && !regenerate) return { status: "done", value: done };
    // "Analyse again" on an input that has not changed since a checked answer: that answer is the answer. No call, no cost.
    if (done && latest.done && done.result.verified && inputHashOf(latest.done) === input.inputHash) {
      return { status: "done", value: done };
    }

    if (!withinFullInputCeiling(input.system, input.user, JSON.stringify(input.schema))) {
      logCode("input-full", "input_too_large");
      return { status: "failed", code: "input_too_large" };
    }

    const started = await store.startJob({
      ...key,
      kind: done || latest.doneAny ? "manual" : "first",
      inputHash: input.inputHash,
      modelId: AI_MODEL_ID,
      modelVersion: input.basis.modelVersion,
      basis: input.basis,
      reserveUsd: maxCostFullCallUsd()
    });

    if (!started.ok) {
      switch (started.reason) {
        case "busy":
          return { status: "pending", ...withPrevious(done) };
        case "exists": {
          const again = await store.latest(key, "full");
          const mine = again.done ? toFullDone(again.done, key.targetGw) : null;
          return mine ? { status: "done", value: mine } : { status: "pending" };
        }
        case "regen_limit":
          return { status: "limit", reason: "regen", ...withPrevious(done) };
        case "month_limit":
          return { status: "limit", reason: "month", ...withPrevious(done) };
        default:
          return { status: "limit", reason: "day", ...withPrevious(done) };
      }
    }

    deps.schedule(runFullJob({ store, client, input, jobId: started.jobId, usageId: started.usageId }));
    return { status: "pending", ...withPrevious(done) };
  } catch (error) {
    if (error instanceof AiStoreError) {
      logCode("request-full", `store_${error.operation}_${error.status}`);
      return { status: "failed", code: "store_unavailable" };
    }
    throw error;
  }
}

/** The paid part of the full-AI mode: the shared call loop with this mode's request, rule check and fallback. */
export async function runFullJob(args: { store: AiStore; client: AiClient; input: FullInput; jobId: string; usageId: string }): Promise<void> {
  const { input } = args;
  await runJobSpec({
    store: args.store,
    client: args.client,
    jobId: args.jobId,
    usageId: args.usageId,
    spec: {
      request: { system: input.system, user: input.user, schema: input.schema, maxTokens: input.maxTokens },
      reserveUsd: maxCostFullCallUsd(),
      validate: (raw) => {
        const checked = validateFullOutput(raw, input.context);
        return checked.ok ? { ok: true, result: input.finalize(checked.value) } : { ok: false, code: checked.code };
      },
      onInvalid: (code) => input.fallback(code)
    }
  });
}
