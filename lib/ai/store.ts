import {
  DAILY_CALL_CAP,
  DAILY_CAP_USD,
  MANUAL_REGENERATIONS_PER_DAY,
  MAX_GENERATIONS_PER_KEY,
  MONTHLY_CAP_USD
} from "@/lib/ai/config";
import type { Locale } from "@/lib/locale";

/**
 * Jobs and usage of the AI layer in Supabase (tables and functions of db/migrations/0002_ai_recommendations.sql),
 * over plain fetch with the service role key, like lib/journal/supabase-store. The caps are enforced INSIDE the
 * database (ai_start_job / ai_reserve_usage lock, sum and insert in one transaction); this file only calls them.
 *
 * Fail closed: when a call to the database does not succeed it throws `AiStoreError`, and the caller must not
 * make a paid call. Errors carry the operation and the HTTP status only, never a body.
 */

export class AiStoreError extends Error {
  constructor(
    readonly operation: string,
    readonly status: number
  ) {
    super(`ai store ${operation} failed (${status})`);
    this.name = "AiStoreError";
  }
}

export type JobKey = { entryId: number; targetGw: number; locale: Locale };
export type JobKind = "first" | "manual";
export type JobStatus = "running" | "done" | "failed";

export type StoredJob = {
  id: string;
  generation: number;
  kind: JobKind;
  status: JobStatus;
  /** The validated answer with names filled in; null unless status is done. */
  result: unknown;
  /** The rules-based candidates the answer sits beside. */
  basis: unknown;
  failureCode: string | null;
  modelId: string;
  modelVersion: string;
  createdAt: string;
  completedAt: string | null;
};

export type StartJobParams = JobKey & {
  kind: JobKind;
  inputHash: string;
  modelId: string;
  modelVersion: string;
  basis: unknown;
  reserveUsd: number;
};

export type RefusalReason = "busy" | "exists" | "regen_limit" | "month_limit" | "day_limit" | "day_calls_limit";
export type StartJobResult = { ok: true; jobId: string; usageId: string; generation: number } | { ok: false; reason: RefusalReason };
export type ReserveResult = { ok: true; usageId: string } | { ok: false; reason: RefusalReason | "job_not_running" };

/**
 * Which answer a job holds. "full" (issue #85) jobs live in the same table and key as the ranking mode's, marked by
 * `basis.mode === "full"` (the column is free-form jsonb), so no migration is needed. They share the key's running
 * slot, its 3 generations and its one manual run a day, which only makes them stricter.
 */
export type JobMode = "standard" | "full";
export const jobModeOf = (job: Pick<StoredJob, "basis">): JobMode =>
  typeof job.basis === "object" && job.basis !== null && (job.basis as { mode?: unknown }).mode === "full" ? "full" : "standard";

export type LatestJobs = {
  /** A running job of either mode: the key has one running slot. */
  running: StoredJob | null;
  /** The latest finished / failed job OF THE MODE asked for. */
  done: StoredJob | null;
  failed: StoredJob | null;
  /** The latest finished job of either mode (a later run of the other mode counts as "manual"). Fakes may omit it. */
  doneAny?: StoredJob | null;
};

export interface AiStore {
  /** Closes jobs of this key that have been "running" since before `olderThanIso` as failed (their usage stays counted). */
  sweepStale(key: JobKey, olderThanIso: string): Promise<void>;
  latest(key: JobKey, mode?: JobMode): Promise<LatestJobs>;
  /** Atomic: no running job for the key, generation caps, then the budget; inserts the job and its reservation. */
  startJob(params: StartJobParams): Promise<StartJobResult>;
  /** Atomic: the budget check and a new reservation for a retry of a running job. */
  reserveUsage(jobId: string, reserveUsd: number): Promise<ReserveResult>;
  settleUsage(usageId: string, settled: { costUsd: number; inputTokens: number; outputTokens: number }): Promise<void>;
  /** The call failed or its usage is unknown: the reserved amount stays counted. */
  failUsage(usageId: string): Promise<void>;
  completeJob(jobId: string, result: unknown): Promise<void>;
  failJob(jobId: string, code: string): Promise<void>;
  /** Everything counted against this month's cap so far (UTC month): reserved and settled amounts together. */
  monthUsageUsd(): Promise<number>;
}

type Row = {
  id: string;
  generation: number;
  request_kind: JobKind;
  status: JobStatus;
  result: unknown;
  basis: unknown;
  failure_code: string | null;
  model_id: string;
  model_version: string;
  created_at: string;
  completed_at: string | null;
};

const toJob = (row: Row): StoredJob => ({
  id: row.id,
  generation: row.generation,
  kind: row.request_kind,
  status: row.status,
  result: row.result,
  basis: row.basis,
  failureCode: row.failure_code,
  modelId: row.model_id,
  modelVersion: row.model_version,
  createdAt: row.created_at,
  completedAt: row.completed_at
});

export type StoreCaps = {
  monthUsd: number;
  dayUsd: number;
  dayCalls: number;
  maxGenerations: number;
  manualPerDay: number;
};

export const DEFAULT_CAPS: StoreCaps = {
  monthUsd: MONTHLY_CAP_USD,
  dayUsd: DAILY_CAP_USD,
  dayCalls: DAILY_CALL_CAP,
  maxGenerations: MAX_GENERATIONS_PER_KEY,
  manualPerDay: MANUAL_REGENERATIONS_PER_DAY
};

const REFUSALS = new Set<string>(["busy", "exists", "regen_limit", "month_limit", "day_limit", "day_calls_limit", "job_not_running"]);

export function createSupabaseAiStore(env: { url: string; serviceKey: string }, caps: StoreCaps = DEFAULT_CAPS): AiStore {
  const base = env.url.replace(/\/$/, "");

  async function call(operation: string, path: string, init: { method?: string; body?: unknown; prefer?: string } = {}) {
    let response: Response;
    try {
      response = await fetch(`${base}${path}`, {
        method: init.method ?? "GET",
        headers: {
          apikey: env.serviceKey,
          Authorization: `Bearer ${env.serviceKey}`,
          "Content-Type": "application/json",
          ...(init.prefer ? { Prefer: init.prefer } : {})
        },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
        cache: "no-store",
        signal: AbortSignal.timeout(10_000)
      });
    } catch {
      throw new AiStoreError(operation, 0);
    }
    if (!response.ok) {
      throw new AiStoreError(operation, response.status);
    }
    return response;
  }

  const keyFilter = (key: JobKey) => `entry_id=eq.${key.entryId}&target_gw=eq.${key.targetGw}&locale=eq.${key.locale}`;

  async function rpc(operation: string, name: string, body: unknown) {
    const response = await call(operation, `/rest/v1/rpc/${name}`, { method: "POST", body });
    return (await response.json().catch(() => null)) as Record<string, unknown> | null;
  }

  return {
    async sweepStale(key, olderThanIso) {
      await call(
        "sweep",
        `/rest/v1/ai_recommendations?${keyFilter(key)}&status=eq.running&created_at=lt.${encodeURIComponent(olderThanIso)}`,
        { method: "PATCH", body: { status: "failed", failure_code: "timeout", completed_at: new Date().toISOString() } }
      );
    },

    async latest(key, mode = "standard") {
      const response = await call(
        "latest",
        `/rest/v1/ai_recommendations?select=id,generation,request_kind,status,result,basis,failure_code,model_id,model_version,created_at,completed_at&${keyFilter(key)}&order=created_at.desc&limit=10`
      );
      const rows = ((await response.json()) as Row[]).map(toJob);
      const ofMode = rows.filter((job) => jobModeOf(job) === mode);
      return {
        running: rows.find((job) => job.status === "running") ?? null,
        done: ofMode.find((job) => job.status === "done") ?? null,
        failed: ofMode.find((job) => job.status === "failed") ?? null,
        doneAny: rows.find((job) => job.status === "done") ?? null
      };
    },

    async startJob(params) {
      const out = await rpc("start", "ai_start_job", {
        p_entry_id: params.entryId,
        p_target_gw: params.targetGw,
        p_locale: params.locale,
        p_kind: params.kind,
        p_input_hash: params.inputHash,
        p_model_id: params.modelId,
        p_model_version: params.modelVersion,
        p_basis: params.basis,
        p_reserve_usd: params.reserveUsd,
        p_month_cap_usd: caps.monthUsd,
        p_day_cap_usd: caps.dayUsd,
        p_day_call_cap: caps.dayCalls,
        p_max_generations: caps.maxGenerations,
        p_manual_per_day: caps.manualPerDay
      });
      if (out?.ok === true && typeof out.job_id === "string" && typeof out.usage_id === "string") {
        return { ok: true, jobId: out.job_id, usageId: out.usage_id, generation: Number(out.generation) };
      }
      if (out?.ok === false && typeof out.reason === "string" && REFUSALS.has(out.reason)) {
        return { ok: false, reason: out.reason as RefusalReason };
      }
      throw new AiStoreError("start", 200);
    },

    async reserveUsage(jobId, reserveUsd) {
      const out = await rpc("reserve", "ai_reserve_usage", {
        p_job_id: jobId,
        p_reserve_usd: reserveUsd,
        p_month_cap_usd: caps.monthUsd,
        p_day_cap_usd: caps.dayUsd,
        p_day_call_cap: caps.dayCalls
      });
      if (out?.ok === true && typeof out.usage_id === "string") {
        return { ok: true, usageId: out.usage_id };
      }
      if (out?.ok === false && typeof out.reason === "string" && REFUSALS.has(out.reason)) {
        return { ok: false, reason: out.reason as RefusalReason | "job_not_running" };
      }
      throw new AiStoreError("reserve", 200);
    },

    async settleUsage(usageId, settled) {
      await call("settle", `/rest/v1/ai_usage?id=eq.${encodeURIComponent(usageId)}`, {
        method: "PATCH",
        body: {
          status: "settled",
          cost_usd: settled.costUsd,
          input_tokens: settled.inputTokens,
          output_tokens: settled.outputTokens,
          settled_at: new Date().toISOString()
        }
      });
    },

    async failUsage(usageId) {
      await call("fail-usage", `/rest/v1/ai_usage?id=eq.${encodeURIComponent(usageId)}&status=eq.reserved`, {
        method: "PATCH",
        body: { status: "failed", settled_at: new Date().toISOString() }
      });
    },

    async completeJob(jobId, result) {
      await call("complete", `/rest/v1/ai_recommendations?id=eq.${encodeURIComponent(jobId)}&status=eq.running`, {
        method: "PATCH",
        body: { status: "done", result, completed_at: new Date().toISOString() }
      });
    },

    async monthUsageUsd() {
      const now = new Date();
      const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
      const response = await call("month-usage", `/rest/v1/ai_usage?select=cost_usd&created_at=gte.${encodeURIComponent(monthStart)}&limit=5000`);
      const rows = (await response.json()) as Array<{ cost_usd: number | string }>;
      if (!Array.isArray(rows)) {
        throw new AiStoreError("month-usage", 200);
      }
      return rows.reduce((sum, row) => sum + Number(row.cost_usd), 0);
    },

    async failJob(jobId, code) {
      await call("fail-job", `/rest/v1/ai_recommendations?id=eq.${encodeURIComponent(jobId)}&status=eq.running`, {
        method: "PATCH",
        body: { status: "failed", failure_code: code.slice(0, 64), completed_at: new Date().toISOString() }
      });
    }
  };
}
