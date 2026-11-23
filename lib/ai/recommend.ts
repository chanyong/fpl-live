import { AiCallError, type AiCallRequest, type AiClient } from "@/lib/ai/anthropic-client";
import { costUsd, maxCostPerCallUsd, withinInputCeiling } from "@/lib/ai/budget";
import { AI_MODEL_ID, MAX_RETRIES, MONTHLY_CAP_USD, STALE_RUNNING_MS, isAllowedEntry, type AiConfig } from "@/lib/ai/config";
import type { FullInput } from "@/lib/ai/full-input";
import type { AiInput } from "@/lib/ai/input-bundle";
import { AI_OUTPUT_JSON_SCHEMA, validateAiOutput, type AiResult } from "@/lib/ai/schema";
import { AiStoreError, type AiStore, type JobKey, type StoredJob } from "@/lib/ai/store";
import type { Locale } from "@/lib/locale";

/**
 * The AI recommendation flow (issue #43, stages 2-3): gate, stored copy, one job per key, a reservation in the
 * database before every paid call, the call, the validation, the stored answer. Nothing here runs unless a
 * person's request arrives: no timer, no cron, no background regeneration.
 *
 * Everything outside the flow is injected (`AiDeps`): the store, the Anthropic client, the input builder and the
 * scheduler of the background step. Tests pass fakes; nothing in them reaches the network.
 */

export type AiDeps = {
  config: AiConfig;
  /** Null (with the client) when the layer is off: no database connection is made either. */
  store: AiStore | null;
  client: AiClient | null;
  /** The rules-based result, the model input and the server basis for one team (reads the shared caches). */
  loadInput: (entryId: number, locale: Locale) => Promise<AiInput>;
  /** Full-AI mode (issue #85): the larger input and its rule checker. Absent = the mode is not offered (answers "failed"). */
  loadFullInput?: (entryId: number, locale: Locale) => Promise<FullInput>;
  /** The gameweek a new analysis would target (the first whose deadline has not passed); null when unknown. */
  targetGw: () => Promise<number | null>;
  /** Runs the call after the response was sent. The default just lets the promise run. */
  schedule: (job: Promise<void>) => void;
  now: () => number;
};

export type DonePayload = {
  targetGw: number;
  generation: number;
  kind: "first" | "manual";
  completedAt: string | null;
  modelId: string;
  modelVersion: string;
  result: AiResult;
  /** The rules-based candidates with their server figures (weights, xP, scenario numbers) and the names. */
  basis: unknown;
};

export type LimitReason = "month" | "day" | "regen";

export type AiOutcomeOf<P> =
  | { status: "done"; value: P }
  | { status: "pending"; previous?: P }
  | { status: "failed"; code: string }
  | { status: "none" }
  | { status: "disabled" }
  | { status: "not_allowed" }
  | { status: "limit"; reason: LimitReason; previous?: P };

export type AiOutcome = AiOutcomeOf<DonePayload>;

/** Off, or a team that is not on the list: the rules-based result only. */
export function aiGate(entryId: number, deps: AiDeps): AiOutcomeOf<never> | null {
  if (!deps.config.enabled || !deps.store || !deps.client) {
    return { status: "disabled" };
  }
  if (!isAllowedEntry(entryId)) {
    return { status: "not_allowed" };
  }
  return null;
}

function toDone(job: StoredJob, targetGw: number): DonePayload | null {
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
    result: job.result as AiResult,
    basis: job.basis
  };
}

export const withPrevious = <P>(previous: P | null) => (previous ? { previous } : {});

export function logCode(where: string, code: string) {
  // Codes only: never the request, a header, the key or an SDK message.
  console.error(`[entry-ai] ${where}: ${code}`);
}

export type BudgetNotice = "near_limit" | null;

/** The notice appears once this share of the month's cap is counted: 80%. Compared in integers' terms (usage x 5 >= cap x 4) so 79.9% and 80% never swap through rounding. */
const NOTICE_SHARE = { numerator: 4, denominator: 5 } as const;

let lastBudgetLogDay: string | null = null;

/** For tests. */
export function resetBudgetNoticeLog() {
  lastBudgetLogDay = null;
}

/**
 * "near_limit" once this month's counted usage (reserved + settled) is at 80% of the monthly cap, else null. It
 * carries no amount and no token count. A failed read is null: the notice is a courtesy, never an error. The
 * server log gets one code line (`[entry-ai] budget_80`, no amount) at most once a day per process.
 */
export async function readBudgetNotice(deps: AiDeps): Promise<BudgetNotice> {
  if (!deps.store) return null;
  try {
    const used = await deps.store.monthUsageUsd();
    if (!Number.isFinite(used) || used * NOTICE_SHARE.denominator < MONTHLY_CAP_USD * NOTICE_SHARE.numerator) {
      return null;
    }
    const today = new Date(deps.now()).toISOString().slice(0, 10);
    if (lastBudgetLogDay !== today) {
      lastBudgetLogDay = today;
      // A code only: no amount, no key.
      console.error("[entry-ai] budget_80");
    }
    return "near_limit";
  } catch {
    return null;
  }
}

/** State of one key for a status poll: reads only, never starts anything. */
export async function readEntryAi(entryId: number, locale: Locale, deps: AiDeps): Promise<AiOutcome> {
  const gate = aiGate(entryId, deps);
  if (gate) return gate;
  const store = deps.store as AiStore;

  try {
    const targetGw = await deps.targetGw();
    if (targetGw === null) {
      return { status: "failed", code: "fpl_unavailable" };
    }
    const key: JobKey = { entryId, targetGw, locale };
    await store.sweepStale(key, new Date(deps.now() - STALE_RUNNING_MS).toISOString());
    const latest = await store.latest(key);
    const done = latest.done ? toDone(latest.done, targetGw) : null;
    if (latest.running) return { status: "pending", ...withPrevious(done) };
    if (done) return { status: "done", value: done };
    if (latest.failed) return { status: "failed", code: latest.failed.failureCode ?? "failed" };
    return { status: "none" };
  } catch (error) {
    if (error instanceof AiStoreError) {
      logCode("read", `store_${error.operation}_${error.status}`);
      return { status: "failed", code: "store_unavailable" };
    }
    throw error;
  }
}

/**
 * POST: a stored answer is returned as it is (cost 0); otherwise one job is created with its reservation and
 * the call is scheduled. Nothing paid happens unless the reservation succeeded.
 */
export async function requestEntryAi(
  request: { entryId: number; locale: Locale; regenerate: boolean },
  deps: AiDeps
): Promise<AiOutcome> {
  const { entryId, locale, regenerate } = request;
  const gate = aiGate(entryId, deps);
  if (gate) return gate;
  const store = deps.store as AiStore;
  const client = deps.client as AiClient;

  try {
    // A stored copy or a running job is answered before anything is built: no transfer search, no model input.
    const knownGw = await deps.targetGw();
    if (knownGw === null) {
      return { status: "failed", code: "fpl_unavailable" };
    }
    const staleBefore = new Date(deps.now() - STALE_RUNNING_MS).toISOString();
    await store.sweepStale({ entryId, targetGw: knownGw, locale }, staleBefore);
    const first = await store.latest({ entryId, targetGw: knownGw, locale });
    const firstDone = first.done ? toDone(first.done, knownGw) : null;
    if (first.running) return { status: "pending", ...withPrevious(firstDone) };
    if (firstDone && !regenerate) return { status: "done", value: firstDone };

    const input = await deps.loadInput(entryId, locale);
    // The table is rebuilt when a deadline passes: use the gameweek the input was really built for.
    const key: JobKey = { entryId, targetGw: input.basis.targetGw, locale };
    let latest = key.targetGw === knownGw ? first : await store.latest(key);
    let done = latest.done ? toDone(latest.done, key.targetGw) : null;
    if (latest.running) return { status: "pending", ...withPrevious(done) };
    if (done && !regenerate) return { status: "done", value: done };

    // The output schema is billed as input too.
    if (!withinInputCeiling(input.system, input.user, JSON.stringify(AI_OUTPUT_JSON_SCHEMA))) {
      logCode("input", "input_too_large");
      return { status: "failed", code: "input_too_large" };
    }

    const started = await store.startJob({
      ...key,
      // A finished answer of the other mode also makes this run a "manual" one (the database refuses a second "first").
      kind: done || latest.doneAny ? "manual" : "first",
      inputHash: input.inputHash,
      modelId: AI_MODEL_ID,
      modelVersion: input.basis.modelVersion,
      basis: input.basis,
      reserveUsd: maxCostPerCallUsd()
    });

    if (!started.ok) {
      switch (started.reason) {
        case "busy":
          return { status: "pending", ...withPrevious(done) };
        case "exists":
          // Someone finished the first analysis between the read and the start.
          latest = await store.latest(key);
          done = latest.done ? toDone(latest.done, key.targetGw) : null;
          return done ? { status: "done", value: done } : { status: "pending" };
        case "regen_limit":
          return { status: "limit", reason: "regen", ...withPrevious(done) };
        case "month_limit":
          return { status: "limit", reason: "month", ...withPrevious(done) };
        default:
          return { status: "limit", reason: "day", ...withPrevious(done) };
      }
    }

    deps.schedule(runJob({ store, client, input, jobId: started.jobId, usageId: started.usageId }));
    return { status: "pending", ...withPrevious(done) };
  } catch (error) {
    if (error instanceof AiStoreError) {
      logCode("request", `store_${error.operation}_${error.status}`);
      return { status: "failed", code: "store_unavailable" };
    }
    throw error;
  }
}

/** Call failures where the API refused the request before doing any work (HTTP 400, 401/403, 429). */
const UNBILLED_CODES = new Set(["api_bad_request", "api_auth", "api_rate_limit"]);

async function quietly(step: () => Promise<void>, where: string) {
  try {
    await step();
  } catch (error) {
    logCode(where, error instanceof AiStoreError ? `store_${error.operation}_${error.status}` : "error");
  }
}

function parseModelJson(text: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}

/** What one paid job needs: the request, what to reserve per call, how to check the answer. */
export type JobSpec = {
  request: AiCallRequest;
  /** Reserved in the database before the call and again before a retry. */
  reserveUsd: number;
  /** The checked answer to store, or the code of the broken rule. */
  validate: (raw: unknown) => { ok: true; result: unknown } | { ok: false; code: string };
  /**
   * What to store when the answer still breaks a rule after the retry. Absent: the job fails with `invalid_output:<code>`.
   * Full-AI mode stores the rules engine's own option here, marked as not verified (issue #85).
   */
  onInvalid?: (code: string) => unknown;
};

/**
 * The paid part: call, settle the real cost, check the answer, store it. One retry at most, only for an answer
 * that failed validation, and only after a second reservation succeeded. A refusal or a truncation is never
 * read or retried. A failed or unreadable call leaves its reservation counted (the cost is unknown).
 */
export async function runJobSpec(args: { store: AiStore; client: AiClient; spec: JobSpec; jobId: string; usageId: string }): Promise<void> {
  const { store, client, spec, jobId } = args;
  let usageId = args.usageId;

  try {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
      let response: Awaited<ReturnType<AiClient["generate"]>>;
      try {
        response = await client.generate(spec.request);
      } catch (error) {
        const code = error instanceof AiCallError ? error.code : "api_unknown";
        // A request the API rejected outright is not billed: free its reservation. Anything else (timeout,
        // connection loss, 5xx) may have been billed, so the reserved amount stays counted.
        await quietly(
          () =>
            UNBILLED_CODES.has(code)
              ? store.settleUsage(usageId, { costUsd: 0, inputTokens: 0, outputTokens: 0 })
              : store.failUsage(usageId),
          "fail-usage"
        );
        logCode("call", code);
        await store.failJob(jobId, code);
        return;
      }

      await quietly(
        () =>
          store.settleUsage(usageId, {
            costUsd: costUsd(response.usage),
            inputTokens: response.usage.input + response.usage.cacheRead + response.usage.cacheWrite,
            outputTokens: response.usage.output
          }),
        "settle"
      );

      if (response.stopReason === "refusal") {
        await store.failJob(jobId, "refusal");
        return;
      }
      if (response.stopReason === "max_tokens") {
        await store.failJob(jobId, "truncated");
        return;
      }
      if (response.stopReason !== "end_turn") {
        await store.failJob(jobId, "unexpected_stop");
        return;
      }

      const json = parseModelJson(response.text);
      const checked = json.ok ? spec.validate(json.value) : ({ ok: false, code: "bad_json" } as const);
      if (checked.ok) {
        await store.completeJob(jobId, checked.result);
        return;
      }
      if (attempt >= MAX_RETRIES) {
        if (spec.onInvalid) {
          await store.completeJob(jobId, spec.onInvalid(checked.code));
        } else {
          await store.failJob(jobId, `invalid_output:${checked.code}`);
        }
        return;
      }

      const again = await store.reserveUsage(jobId, spec.reserveUsd);
      if (!again.ok) {
        await store.failJob(jobId, "limit");
        return;
      }
      usageId = again.usageId;
    }
  } catch (error) {
    logCode("job", error instanceof AiStoreError ? `store_${error.operation}_${error.status}` : "error");
    await quietly(() => store.failJob(jobId, "internal"), "fail-job");
  }
}

/** The ranking mode's job (issue #43): its request, its reservation and its answer check. */
export async function runJob(args: { store: AiStore; client: AiClient; input: AiInput; jobId: string; usageId: string }): Promise<void> {
  const { input } = args;
  await runJobSpec({
    store: args.store,
    client: args.client,
    jobId: args.jobId,
    usageId: args.usageId,
    spec: {
      request: { system: input.system, user: input.user },
      reserveUsd: maxCostPerCallUsd(),
      validate: (raw) => {
        const checked = validateAiOutput(raw, input.context);
        return checked.ok ? { ok: true, result: checked.value } : { ok: false, code: checked.code };
      }
    }
  });
}
