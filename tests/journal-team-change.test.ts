import { describe, expect, it, vi } from "vitest";
import { changeMemberTeam, nextTeamChangeAt } from "@/lib/journal/service";
import { TEAM_CHANGE_COOLDOWN_DAYS, type ChangeTeamResult, type JournalStore } from "@/lib/journal/types";

// Issue #47: a member changes the registered team (the service in front of the database function journal_change_team).
const NOW = Date.parse("2026-11-22T00:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

type Profile = { teamId: number; teamChangedAt: string | null } | null;

function store(profile: Profile, changeTeam: () => Promise<ChangeTeamResult> = async () => ({ code: "ok" })) {
  return {
    getProfile: vi.fn(async () => profile),
    changeTeam: vi.fn(changeTeam)
  } as unknown as JournalStore & { changeTeam: ReturnType<typeof vi.fn> };
}

const found = vi.fn(async () => "found" as const);
const run = (s: JournalStore, check: () => Promise<"found" | "missing" | "unavailable"> = found) => changeMemberTeam(s, "u1", 9, check, NOW);

describe("changeMemberTeam", () => {
  it("changes the team: the cheap checks pass, FPL is asked once, then the database function runs with the 30-day wait", async () => {
    found.mockClear();
    const s = store({ teamId: 5, teamChangedAt: null });
    expect(await run(s)).toEqual({ ok: true });
    expect(found).toHaveBeenCalledWith(9);
    expect(s.changeTeam).toHaveBeenCalledWith("u1", 9, TEAM_CHANGE_COOLDOWN_DAYS);
    expect(TEAM_CHANGE_COOLDOWN_DAYS).toBe(30);
  });

  it("also works for a member whose profile is missing (the function creates it)", async () => {
    const s = store(null);
    expect(await run(s)).toEqual({ ok: true });
    expect(s.changeTeam).toHaveBeenCalledTimes(1);
  });

  it("same_team: no FPL call, no change", async () => {
    found.mockClear();
    const s = store({ teamId: 9, teamChangedAt: null });
    expect(await run(s)).toEqual({ ok: false, code: "same_team" });
    expect(found).not.toHaveBeenCalled();
    expect(s.changeTeam).not.toHaveBeenCalled();
  });

  it("too_soon inside 30 days with the next possible time, and allowed again after them", async () => {
    found.mockClear();
    const s = store({ teamId: 5, teamChangedAt: new Date(NOW - 10 * DAY).toISOString() });
    expect(await run(s)).toEqual({ ok: false, code: "too_soon", nextChangeAt: new Date(NOW + 20 * DAY).toISOString() });
    expect(found).not.toHaveBeenCalled();
    expect(s.changeTeam).not.toHaveBeenCalled();

    const later = store({ teamId: 5, teamChangedAt: new Date(NOW - 31 * DAY).toISOString() });
    expect(await run(later)).toEqual({ ok: true });
  });

  it("team_not_found and fpl_unavailable stop before the database function", async () => {
    const s = store({ teamId: 5, teamChangedAt: null });
    expect(await run(s, async () => "missing")).toEqual({ ok: false, code: "team_not_found" });
    expect(await run(s, async () => "unavailable")).toEqual({ ok: false, code: "fpl_unavailable" });
    expect(s.changeTeam).not.toHaveBeenCalled();
  });

  it("passes the database function's answers through: team_taken, a race for too_soon / same_team, and a failure", async () => {
    const profile: Profile = { teamId: 5, teamChangedAt: null };
    expect(await run(store(profile, async () => ({ code: "team_taken" })))).toEqual({ ok: false, code: "team_taken" });
    expect(await run(store(profile, async () => ({ code: "too_soon", nextChangeAt: "2026-12-01T00:00:00.000Z" })))).toEqual({
      ok: false,
      code: "too_soon",
      nextChangeAt: "2026-12-01T00:00:00.000Z"
    });
    expect(await run(store(profile, async () => ({ code: "same_team" })))).toEqual({ ok: false, code: "same_team" });
    expect(await run(store(profile, async () => ({ code: "error" })))).toEqual({ ok: false, code: "change_failed" });
  });
});

describe("nextTeamChangeAt", () => {
  it("is null when never changed, past the wait, or unreadable; otherwise the end of the wait", () => {
    expect(nextTeamChangeAt(null, 30, NOW)).toBeNull();
    expect(nextTeamChangeAt("not a date", 30, NOW)).toBeNull();
    expect(nextTeamChangeAt(new Date(NOW - 31 * DAY).toISOString(), 30, NOW)).toBeNull();
    expect(nextTeamChangeAt(new Date(NOW - DAY).toISOString(), 30, NOW)).toBe(new Date(NOW + 29 * DAY).toISOString());
  });
});
