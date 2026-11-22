/** FPL league ids are positive integers; anything else must never reach the upstream URL. */
export function parseLeagueId(raw: string | null) {
  if (!raw) {
    return { error: "leagueId query parameter is required" } as const;
  }

  const leagueId = Number(raw);
  if (!Number.isInteger(leagueId) || leagueId <= 0) {
    return { error: "leagueId must be a positive integer" } as const;
  }

  return { leagueId } as const;
}

/** FPL element ids are positive integers; anything else must never reach the upstream URL. */
export function parseElementId(raw: string | null) {
  if (!raw) {
    return { error: "elementId query parameter is required" } as const;
  }

  const elementId = Number(raw);
  if (!Number.isInteger(elementId) || elementId <= 0) {
    return { error: "elementId must be a positive integer" } as const;
  }

  return { elementId } as const;
}

/** Accepts "current" or a gameweek number in the 1-38 range. */
export function parseGw(raw: string | null) {
  const value = raw ?? "current";
  if (value === "current") {
    return { gw: "current" } as const;
  }

  const gw = Number(value);
  if (!Number.isInteger(gw) || gw < 1 || gw > 38) {
    return { error: "gw must be \"current\" or a gameweek between 1 and 38" } as const;
  }

  return { gw: String(gw) } as const;
}

/** FPL entry (team) ids are positive integers; anything else must never reach the upstream URL. */
export function parseEntryId(raw: string | null) {
  if (!raw) {
    return { error: "entryId query parameter is required" } as const;
  }

  // Digits only: Number() would also accept "1e3", "0x10" and " 12 ".
  const entryId = /^\d{1,10}$/.test(raw) ? Number(raw) : NaN;
  if (!Number.isInteger(entryId) || entryId <= 0 || entryId > 2_000_000_000) {
    return { error: "entryId must be a positive integer" } as const;
  }

  return { entryId } as const;
}
