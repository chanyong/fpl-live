/**
 * Brake on the personal-squad API (issue #39 stage 2). Anyone can type any entry ID, so the limits are meant
 * to stop someone walking through IDs, not to guard a secret (the data is public on FPL itself):
 *
 * - at most 20 requests per IP per minute;
 * - at most 12 different entry IDs per IP per 10 minutes (reloading the same team is free);
 * - a forced refresh of one team at most once per 30 seconds per IP.
 *
 * In memory, one process, resets on deploy — the same trade-off as lib/journal/rate-limit.
 */
const MINUTE_MS = 60_000;
const DISTINCT_WINDOW_MS = 10 * MINUTE_MS;
const MAX_PER_MINUTE = 20;
const MAX_DISTINCT_ENTRIES = 12;
const REFRESH_COOLDOWN_MS = 30_000;
const MAX_KEYS = 5000;

const hits = new Map<string, number[]>();
const distinct = new Map<string, Map<number, number>>();
const refreshes = new Map<string, number>();

export function resetEntryRequestLimits() {
  hits.clear();
  distinct.clear();
  refreshes.clear();
}

function prune(now: number) {
  if (hits.size + distinct.size + refreshes.size < MAX_KEYS) return;
  for (const [ip, times] of hits) if (!times.some((at) => now - at <= MINUTE_MS)) hits.delete(ip);
  for (const [ip, seen] of distinct) {
    for (const [entry, at] of seen) if (now - at > DISTINCT_WINDOW_MS) seen.delete(entry);
    if (seen.size === 0) distinct.delete(ip);
  }
  for (const [key, at] of refreshes) if (now - at > REFRESH_COOLDOWN_MS) refreshes.delete(key);
}

export type EntryRequestVerdict = { allowed: true } | { allowed: false; retryAfterSeconds: number };

/** Records the request when it is allowed. `refresh` is a forced reload that skips the server cache. */
export function checkEntryRequest(ip: string, entryId: number, refresh: boolean, now = Date.now()): EntryRequestVerdict {
  prune(now);

  const recent = (hits.get(ip) ?? []).filter((at) => now - at <= MINUTE_MS);
  if (recent.length >= MAX_PER_MINUTE) {
    hits.set(ip, recent);
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((recent[0] + MINUTE_MS - now) / 1000)) };
  }

  const seen = distinct.get(ip) ?? new Map<number, number>();
  for (const [entry, at] of seen) if (now - at > DISTINCT_WINDOW_MS) seen.delete(entry);
  if (!seen.has(entryId) && seen.size >= MAX_DISTINCT_ENTRIES) {
    distinct.set(ip, seen);
    const oldest = Math.min(...seen.values());
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((oldest + DISTINCT_WINDOW_MS - now) / 1000)) };
  }

  const refreshKey = `${ip}:${entryId}`;
  const lastRefresh = refreshes.get(refreshKey);
  if (refresh && lastRefresh !== undefined && now - lastRefresh < REFRESH_COOLDOWN_MS) {
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((lastRefresh + REFRESH_COOLDOWN_MS - now) / 1000)) };
  }

  hits.set(ip, [...recent, now]);
  seen.set(entryId, now);
  distinct.set(ip, seen);
  if (refresh) refreshes.set(refreshKey, now);
  return { allowed: true };
}
