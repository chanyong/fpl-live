import { getEntry } from "@/lib/fpl-client";

export type TeamLookup =
  | { ok: true; teamId: number; teamName: string; managerName: string }
  | { ok: false; code: "team_not_found" | "fpl_unavailable" };

const TTL_MS = 5 * 60_000;
const MAX_ENTRIES = 500;
const found = new Map<number, { at: number; value: Extract<TeamLookup, { ok: true }> }>();

export function resetTeamLookupCache() {
  found.clear();
}

/**
 * Looks one FPL team up (name and manager) from FPL's public entry data, with a 5-minute in-memory cache of the teams that
 * exist so a member (or a sign-up form) re-checking the same number adds no FPL call. Only a real 404 means the team is
 * missing (the same rule as the sign-up route); outages and rate limits say "unavailable" so the user retries.
 */
export async function lookupTeam(teamId: number, now = Date.now()): Promise<TeamLookup> {
  const cached = found.get(teamId);
  if (cached && now - cached.at < TTL_MS) return cached.value;
  try {
    const entry = await getEntry(teamId);
    const value = {
      ok: true as const,
      teamId,
      teamName: entry.name,
      managerName: `${entry.player_first_name} ${entry.player_last_name}`.trim()
    };
    found.delete(teamId);
    found.set(teamId, { at: now, value });
    while (found.size > MAX_ENTRIES) {
      const oldest = found.keys().next().value;
      if (oldest === undefined) break;
      found.delete(oldest);
    }
    return value;
  } catch (error) {
    return error instanceof Error && /\(404\)/.test(error.message)
      ? { ok: false, code: "team_not_found" }
      : { ok: false, code: "fpl_unavailable" };
  }
}
