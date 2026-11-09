import { describe, expect, it, vi } from "vitest";
import { buildWeeklySnapshot, mergeDetailIntoSnapshot, groupFixturesByDay, hasSnapshotDetail, playerDisplayPoints } from "@/lib/journal-snapshot";
import { runSnapshotBackfill, runSnapshotJob, type FplSource } from "@/lib/journal/service";
import type { JournalStore } from "@/lib/journal/types";

describe("snapshot detail (issue #27)", () => {
  const history = {
    current: [{ event: 5, points: 61, total_points: 300, overall_rank: 1000, rank: 77, event_transfers: 1, event_transfers_cost: 4, points_on_bench: 7 }],
    chips: []
  };
  const picks = Array.from({ length: 15 }, (_, i) => ({ element: 100 + i, position: i + 1, multiplier: i === 2 ? 2 : i < 11 ? 1 : 0, isCaptain: i === 2, isVice: i === 3 }));
  const detail = {
    players: [{ id: 102, name: "Haaland", team: 1, type: 4 }],
    teams: [
      { id: 1, short: "MCI" },
      { id: 2, short: "ARS" }
    ],
    live: [{ id: 102, points: 9, minutes: 90, explain: [{ fixture: 1, stats: [{ id: "minutes", value: 90, points: 2 }, { id: "goals_scored", value: 1, points: 7 }] }] }],
    autoSubs: [{ in: 111, out: 105 }],
    average: 50,
    highest: 120
  };
  const fixtures = [{ id: 1, event: 5, teamH: 1, teamA: 2, scoreH: 2, scoreA: 0, kickoff: "2026-09-05T14:00:00Z", finished: true }];

  it("freezes names, ledger, vice captain, auto subs and gameweek stats", () => {
    const snap = buildWeeklySnapshot({ gw: 5, history, picks, fixtures, detail })!;
    expect(snap).toMatchObject({ viceCaptain: 103, gwRank: 77, average: 50, highest: 120, autoSubs: [{ in: 111, out: 105 }], teams: { "1": "MCI", "2": "ARS" } });
    const haaland = snap.players!.find((p) => p.id === 102)!;
    expect(haaland).toMatchObject({ name: "Haaland", team: "MCI", type: 4, slot: 3, multiplier: 2, isCaptain: true, points: 9, minutes: 90 });
    expect(playerDisplayPoints(haaland)).toBe(18);
    // A player missing from the catalog still gets a row instead of breaking the week.
    expect(snap.players!.find((p) => p.id === 101)).toMatchObject({ name: "#101", points: 0, fixtures: [] });
    expect(snap.fixtures[0]).toMatchObject({ kickoff: "2026-09-05T14:00:00Z", finished: true });
  });

  it("keeps the old shape when no detail is given", () => {
    const snap = buildWeeklySnapshot({ gw: 5, history, picks, fixtures })!;
    expect(snap.players).toBeUndefined();
    expect(hasSnapshotDetail(snap)).toBe(false);
  });

  it("detects detail and groups fixtures by day with undated last", () => {
    expect(hasSnapshotDetail({ players: [] })).toBe(true);
    expect(hasSnapshotDetail(null)).toBe(false);
    const groups = groupFixturesByDay([{ kickoff: "2026-09-06T10:00:00Z" }, { kickoff: null }, { kickoff: "2026-09-05T18:00:00Z" }, { kickoff: "2026-09-05T11:00:00Z" }]);
    expect(groups.map((g) => [g.day, g.items.length])).toEqual([["2026-09-05", 2], ["2026-09-06", 1], ["", 1]]);
  });
});

function fakeStore(overrides: Partial<JournalStore> = {}) {
  const saved = new Map<string, Set<number>>();
  return {
    listProfiles: vi.fn(async () => [
      { userId: "u1", teamId: 111 },
      { userId: "u2", teamId: 222 }
    ]),
    savedGws: vi.fn(async (id: string) => [...(saved.get(id) ?? [])]),
    snapshotsOf: vi.fn(async () => []),
    saveSnapshot: vi.fn(async (id: string, gw: number) => {
      saved.set(id, (saved.get(id) ?? new Set()).add(gw));
    }),
    ...overrides
  } as unknown as JournalStore;
}

describe("detail capture and backfill (issue #27)", () => {
  const history = {
    current: [1, 2].map((event) => ({ event, points: 50, total_points: 50 * event, overall_rank: 10, event_transfers: 0, event_transfers_cost: 0, points_on_bench: 0 })),
    chips: []
  };
  const detailed = (overrides: Partial<FplSource> = {}): FplSource => ({
    events: async () => [{ id: 1, finished: true, average_entry_score: 40, highest_score: 99 }, { id: 2, finished: true }],
    history: async () => history,
    picks: async () => ({ picks: [{ element: 1, position: 1, multiplier: 1, isCaptain: true, isVice: false }], autoSubs: [] }),
    fixtures: async () => [],
    catalog: vi.fn(async () => ({ players: [{ id: 1, name: "Raya", team: 1, type: 1 }], teams: [{ id: 1, short: "ARS" }] })),
    live: vi.fn(async () => [{ id: 1, points: 6, minutes: 90, explain: [] }]),
    ...overrides
  });

  it("saves the ledger and fetches the catalog once and live once per gameweek, not per member", async () => {
    const store = fakeStore();
    const fpl = detailed();
    await runSnapshotJob(store, fpl);
    expect(fpl.catalog).toHaveBeenCalledTimes(1);
    expect(fpl.live).toHaveBeenCalledTimes(2);
    const first = (store.saveSnapshot as ReturnType<typeof vi.fn>).mock.calls[0][2] as { players: unknown[]; average: number };
    expect(first.players).toHaveLength(1);
    expect(first.average).toBe(40);
  });

  it("does not save a week whose live data failed, so the next run retries it", async () => {
    const store = fakeStore();
    const broken = detailed({
      live: async () => {
        throw new Error("live down");
      }
    });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await runSnapshotJob(store, broken)).toEqual({ users: 2, saved: 0, failed: 4 });
    expect(store.saveSnapshot).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  const oldRows = [
    { gw: 1, snapshot: { gw: 1, points: 999, totalPoints: 1, extra: "keep", fixtures: [{ id: 7, teamH: 1, teamA: 2, scoreH: 0, scoreA: 0 }] } },
    { gw: 2, snapshot: { gw: 2, points: 50, players: [] } }
  ];

  it("backfill is a dry run by default: reports targets, writes nothing, calls no FPL", async () => {
    const store = fakeStore({ snapshotsOf: vi.fn(async () => oldRows) });
    const fpl = detailed();
    expect(await runSnapshotBackfill(store, fpl)).toEqual({ dryRun: true, users: 2, targets: 2, byGw: { "1": 2 }, written: 0, failed: 0 });
    expect(store.saveSnapshot).not.toHaveBeenCalled();
    expect(fpl.live).not.toHaveBeenCalled();
  });

  it("backfill only writes with write:true, merges onto the old snapshot and honors gws and limit", async () => {
    const store = fakeStore({ snapshotsOf: vi.fn(async () => oldRows) });
    expect((await runSnapshotBackfill(store, detailed(), { write: false })).written).toBe(0);
    expect(store.saveSnapshot).not.toHaveBeenCalled();
    expect(await runSnapshotBackfill(store, detailed(), { write: true, limit: 1 })).toMatchObject({ dryRun: false, written: 1, failed: 0 });
    const written = (store.saveSnapshot as ReturnType<typeof vi.fn>).mock.calls[0][2] as Record<string, unknown>;
    // Old values stay exactly as saved (FPL now says 50 points; the journal keeps 999), only new keys are added.
    expect(written).toMatchObject({ extra: "keep", gw: 1, points: 999, totalPoints: 1 });
    expect((store.saveSnapshot as ReturnType<typeof vi.fn>).mock.calls[0][3]).toEqual({ keepSavedAt: true });
    expect(Array.isArray(written.players)).toBe(true);
    expect((await runSnapshotBackfill(store, detailed(), { gws: [2] })).targets).toBe(0);
  });
});

describe("mergeDetailIntoSnapshot", () => {
  const fresh = {
    gw: 1, points: 1, totalPoints: 2, overallRank: 3, transfers: 4, transferCost: 4, benchPoints: 5, chip: "bboost", captain: 9, starters: [9], bench: [8],
    fixtures: [{ id: 7, teamH: 1, teamA: 2, scoreH: 3, scoreA: 3, kickoff: "2026-09-05T14:00:00Z", finished: true }],
    viceCaptain: 8, autoSubs: [], gwRank: 5, average: 50, highest: 99, teams: { "1": "ARS" }, players: []
  };
  it("never changes an existing value, only appends missing keys and fixture kickoff/finished", () => {
    const old = { gw: 1, points: 40, chip: null, captain: 1, starters: [1], bench: [2], fixtures: [{ id: 7, teamH: 1, teamA: 2, scoreH: 0, scoreA: 0 }, { id: 8, teamH: 3, teamA: 4, scoreH: 1, scoreA: 1 }] };
    const merged = mergeDetailIntoSnapshot(old, fresh as never);
    expect(merged).toMatchObject({ points: 40, chip: null, captain: 1, starters: [1], bench: [2], gwRank: 5, average: 50, players: [], teams: { "1": "ARS" } });
    expect(merged.fixtures).toEqual([
      { id: 7, teamH: 1, teamA: 2, scoreH: 0, scoreA: 0, kickoff: "2026-09-05T14:00:00Z", finished: true },
      { id: 8, teamH: 3, teamA: 4, scoreH: 1, scoreA: 1 }
    ]);
    expect(old.fixtures[0]).not.toHaveProperty("kickoff");
  });
  it("keeps detail that is already there", () => {
    expect(mergeDetailIntoSnapshot({ average: 1 }, fresh as never)).toMatchObject({ average: 1, highest: 99 });
  });
});
