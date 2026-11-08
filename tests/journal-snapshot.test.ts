import { describe, expect, it } from "vitest";
import { buildWeeklySnapshot, getDueSnapshotGws, getNextSnapshotCheck } from "@/lib/journal-snapshot";

describe("getDueSnapshotGws", () => {
  const events = [
    { id: 1, finished: true },
    { id: 2, finished: true },
    { id: 3, finished: true },
    { id: 4, finished: false }
  ];
  it("returns finished weeks not yet saved, including missed ones", () => {
    expect(getDueSnapshotGws(events, [1, 3])).toEqual([2]);
    expect(getDueSnapshotGws(events, [])).toEqual([1, 2, 3]);
  });
  it("returns nothing when all saved", () => {
    expect(getDueSnapshotGws(events, [1, 2, 3])).toEqual([]);
  });
});

describe("getNextSnapshotCheck", () => {
  it("picks the nearest future deadline", () => {
    const events = [
      { id: 9, finished: true, deadline_time: "2026-10-01T10:00:00Z" },
      { id: 11, finished: false, deadline_time: "2026-11-20T10:00:00Z" },
      { id: 10, finished: false, deadline_time: "2026-11-10T10:00:00Z" }
    ];
    expect(getNextSnapshotCheck(events, Date.parse("2026-11-08T00:00:00Z"))).toEqual({ gw: 10, at: "2026-11-10T10:00:00Z" });
    expect(getNextSnapshotCheck(events, Date.parse("2027-01-01T00:00:00Z"))).toBeNull();
  });
});

describe("buildWeeklySnapshot", () => {
  const history = {
    current: [{ event: 5, points: 61, total_points: 300, overall_rank: 1000, event_transfers: 1, event_transfers_cost: 4, points_on_bench: 7 }],
    chips: [{ name: "bboost", event: 5 }]
  };
  const picks = [
    ...Array.from({ length: 15 }, (_, i) => ({ element: 100 + i, position: i + 1, multiplier: 1, isCaptain: i === 2 }))
  ];
  const fixtures = [
    { id: 1, event: 5, teamH: 1, teamA: 2, scoreH: 2, scoreA: 0 },
    { id: 2, event: 6, teamH: 3, teamA: 4, scoreH: null, scoreA: null }
  ];

  it("builds a snapshot for the gameweek", () => {
    const snap = buildWeeklySnapshot({ gw: 5, history, picks, fixtures })!;
    expect(snap).toMatchObject({ gw: 5, points: 61, totalPoints: 300, chip: "bboost", captain: 102, transferCost: 4, benchPoints: 7 });
    expect(snap.starters).toHaveLength(11);
    expect(snap.bench).toEqual([111, 112, 113, 114]);
    expect(snap.fixtures).toEqual([{ id: 1, teamH: 1, teamA: 2, scoreH: 2, scoreA: 0 }]);
  });

  it("returns null for a gameweek FPL has no row for", () => {
    expect(buildWeeklySnapshot({ gw: 6, history, picks, fixtures })).toBeNull();
  });
});
