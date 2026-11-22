import { beforeEach, describe, expect, it, vi } from "vitest";

const getEntry = vi.fn(async (teamId: number) => ({ name: `Team ${teamId}`, player_first_name: "A", player_last_name: "B" }));
vi.mock("@/lib/fpl-client", () => ({ getEntry: (teamId: number) => getEntry(teamId) }));

import { lookupTeam, resetTeamLookupCache } from "@/lib/journal/team-lookup";

// Issue #47 (review): uncached lookups are capped for the whole process, whatever address the caller claims.
describe("lookupTeam process-wide cap", () => {
  beforeEach(() => {
    resetTeamLookupCache();
    getEntry.mockClear();
  });

  it("stops calling FPL after 30 uncached lookups in a minute, still serves cached teams, and recovers a minute later", async () => {
    const now = 1_000_000;
    for (let id = 1; id <= 30; id += 1) expect((await lookupTeam(id, now)).ok).toBe(true);
    expect(await lookupTeam(31, now)).toEqual({ ok: false, code: "fpl_unavailable" });
    expect(getEntry).toHaveBeenCalledTimes(30);
    expect((await lookupTeam(5, now)).ok).toBe(true);
    expect(getEntry).toHaveBeenCalledTimes(30);
    expect((await lookupTeam(31, now + 60_001)).ok).toBe(true);
  });
});
