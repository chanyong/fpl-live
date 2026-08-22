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
