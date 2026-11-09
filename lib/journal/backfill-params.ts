import type { BackfillOptions } from "@/lib/journal/service";

export type BackfillParams = { ok: true; options: BackfillOptions } | { ok: false; param: "gws" | "limit" };

/**
 * Reads ?write, ?gws and ?limit for the backfill. gws/limit, when present, must be fully valid
 * (gws: comma-separated whole numbers 1-38; limit: whole number >= 1), otherwise the request is rejected
 * instead of silently running unbounded. Writing needs exactly write=1.
 */
export function parseBackfillParams(params: URLSearchParams): BackfillParams {
  const options: BackfillOptions = { write: params.get("write") === "1" };

  const rawGws = params.get("gws");
  if (rawGws !== null) {
    const parts = rawGws.split(",");
    if (!parts.every((part) => /^\d{1,2}$/.test(part) && Number(part) >= 1 && Number(part) <= 38)) return { ok: false, param: "gws" };
    options.gws = parts.map(Number);
  }

  const rawLimit = params.get("limit");
  if (rawLimit !== null) {
    if (!/^\d{1,6}$/.test(rawLimit) || Number(rawLimit) < 1) return { ok: false, param: "limit" };
    options.limit = Number(rawLimit);
  }
  return { ok: true, options };
}
