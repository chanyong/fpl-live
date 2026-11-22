import type { ActualResult, LogRow, LogStore, RulesSummary } from "@/lib/ai/rec-log";

/**
 * The recommendation log in Supabase (table ai_recommendation_log of db/migrations/0002), over plain fetch with
 * the service role key, like lib/ai/store. This stage adds no migration: the table is the one 0002 defines, and
 * anything it has no column for lives inside the two jsonb columns.
 *
 * Errors carry the operation and the HTTP status only, never a body. The caller treats every error as "skip".
 */

export class LogStoreError extends Error {
  constructor(
    readonly operation: string,
    readonly status: number
  ) {
    super(`log store ${operation} failed (${status})`);
    this.name = "LogStoreError";
  }
}

type Row = {
  entry_id: number;
  target_gw: number;
  model_version: string;
  rules_summary: unknown;
  actual_result: unknown;
  created_at: string;
  updated_at: string;
};

export function createSupabaseLogStore(env: { url: string; serviceKey: string }): LogStore {
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
      throw new LogStoreError(operation, 0);
    }
    if (!response.ok) {
      throw new LogStoreError(operation, response.status);
    }
    return response;
  }

  return {
    async upsertSummary(row: { entryId: number; targetGw: number; modelVersion: string; rulesSummary: RulesSummary }) {
      // merge-duplicates updates only the columns sent, so `actual_result` and `created_at` stay as they are.
      await call("upsert", "/rest/v1/ai_recommendation_log?on_conflict=entry_id,target_gw", {
        method: "POST",
        prefer: "resolution=merge-duplicates,return=minimal",
        body: {
          entry_id: row.entryId,
          target_gw: row.targetGw,
          model_version: row.modelVersion,
          rules_summary: row.rulesSummary,
          updated_at: new Date().toISOString()
        }
      });
    },

    async listRecent(entryId: number, limit: number): Promise<LogRow[]> {
      const response = await call(
        "list",
        `/rest/v1/ai_recommendation_log?select=entry_id,target_gw,model_version,rules_summary,actual_result,created_at,updated_at&entry_id=eq.${entryId}&order=target_gw.desc&limit=${limit}`
      );
      const rows = (await response.json()) as Row[];
      if (!Array.isArray(rows)) {
        throw new LogStoreError("list", 200);
      }
      return rows.map((row) => ({
        entryId: row.entry_id,
        targetGw: row.target_gw,
        modelVersion: row.model_version,
        rulesSummary: row.rules_summary,
        actualResult: row.actual_result,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
    },

    async setActual(entryId: number, targetGw: number, actual: ActualResult) {
      // Only where it is still null: a result written by an earlier visit is never replaced.
      await call("set-actual", `/rest/v1/ai_recommendation_log?entry_id=eq.${entryId}&target_gw=eq.${targetGw}&actual_result=is.null`, {
        method: "PATCH",
        prefer: "return=minimal",
        body: { actual_result: actual, updated_at: new Date().toISOString() }
      });
    }
  };
}
