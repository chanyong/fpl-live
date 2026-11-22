/**
 * AI recommendation layer: every constant that decides cost, access and shape lives in this file (issue #43,
 * stages 2-3). Nothing here is read from the environment except the on/off switch and the key (`aiConfigFromEnv`).
 *
 * The layer is OFF unless all of these are present (a missing one means "rules-based result only"):
 *   ANTHROPIC_API_KEY        - set by the owner in Railway, never logged, never sent to the browser
 *   AI_RECOMMEND_ENABLED     - exactly "true"
 *   SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY - the usage / job tables (migration 0002)
 */

/** Team IDs allowed to use the AI layer. A code constant on purpose: it cannot be widened by an environment variable. */
export const ALLOWED_ENTRY_IDS: readonly number[] = [4300767];

export const AI_MODEL_ID = "claude-fable-5-2";

/**
 * USD per million tokens (Claude Fable 5.2, checked against the claude-api skill table of 2026-11-03; re-check
 * the price page before raising the caps). Cache prices are only used if a response ever reports cache tokens:
 * this layer sets no cache_control, and a cache write is billed at the dearer 1-hour rate to stay conservative.
 */
export const PRICE_USD_PER_MTOK = { input: 8, output: 40, cacheRead: 0.2, cacheWrite: 16 } as const;

/** Output cap of one call. Thinking tokens count against it, so a too-low value truncates the answer. */
export const AI_MAX_TOKENS = 16_000;

/**
 * Reasoning depth. Starting value `medium`; the claude-api skill suggests `high` for Fable 5.2, so this is to be
 * compared on the trial calls (issue #43 stage A4) and adjusted. Thinking is always on for this model: the
 * `thinking` parameter is NOT sent (explicit values other than adaptive return 400).
 */
export const AI_EFFORT = "medium" as const;

/**
 * Input size guard. The input cannot be counted without a paid count_tokens call, so it is bounded by characters
 * (see `estimateInputTokens`); a request above the ceiling is not sent at all.
 */
export const INPUT_TOKEN_CEILING = 30_000;

/** Caps, enforced inside the database (db/migrations/0002). Every call counts: trials, failures, truncations, retries. */
export const MONTHLY_CAP_USD = 40;
export const DAILY_CAP_USD = 5;
export const DAILY_CALL_CAP = 10;

/** Generations per (team, gameweek, language): the first one, plus people-pressed "analyse again" (once a day each). */
export const MAX_GENERATIONS_PER_KEY = 3;
export const MANUAL_REGENERATIONS_PER_DAY = 1;

/** A job still "running" after this long is closed as failed when someone looks at it. */
export const STALE_RUNNING_MS = 10 * 60_000;

/** One call may take minutes; kept below STALE_RUNNING_MS so a live call is never swept. */
export const AI_REQUEST_TIMEOUT_MS = 8 * 60_000;

/** At most one retry after an output that failed validation (the retry is reserved and counted like any call). */
export const MAX_RETRIES = 1;

export type AiConfig = {
  enabled: boolean;
  /** Only set when enabled. */
  apiKey: string | null;
  supabase: { url: string; serviceKey: string } | null;
};

export function aiConfigFromEnv(env: Record<string, string | undefined> = process.env): AiConfig {
  const apiKey = env.ANTHROPIC_API_KEY?.trim();
  const url = env.SUPABASE_URL?.trim();
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const enabled = env.AI_RECOMMEND_ENABLED?.trim() === "true" && !!apiKey && !!url && !!serviceKey;
  return {
    enabled,
    apiKey: enabled ? (apiKey as string) : null,
    supabase: enabled ? { url: url as string, serviceKey: serviceKey as string } : null
  };
}

export function isAllowedEntry(entryId: number) {
  return ALLOWED_ENTRY_IDS.includes(entryId);
}
