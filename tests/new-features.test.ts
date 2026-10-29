import { describe, expect, it } from "vitest";
import { assignProvisionalBonus, fixtureBonusPreview } from "@/lib/bonus";
import { computeRivalGap, summarizeRankMovement } from "@/lib/rank-movement";
import { addRecentLeague, parseRecentLeagues, removeRecentLeague } from "@/lib/recent-leagues";
import { buildSnapshot, evaluateSnapshot } from "@/lib/price-prediction-log";
import type { LeagueFixture, LeagueRow, PlayerLiveCard, PlayerStat, PriceChangeEvent } from "@/lib/types";

const p = (elementId: number, livePoints: number, isCaptain = false) =>
  ({ elementId, webName: `P${elementId}`, livePoints, isCaptain }) as PlayerLiveCard;

function row(entryId: number, o: Partial<LeagueRow>): LeagueRow {
  return {
    entryId,
    managerName: `M${entryId}`,
    teamName: `T${entryId}`,
    gwPoints: 0,
    projectedTotalPoints: 0,
    projectedRank: 1,
    squad: { starters: [], bench: [] },
    ...o
  } as LeagueRow;
}

describe("bonus", () => {
  it("gives tied third places 1 each", () => {
    const result = assignProvisionalBonus([
      { element: 1, value: 40 },
      { element: 2, value: 30 },
      { element: 3, value: 20 },
      { element: 4, value: 20 }
    ]);
    expect(result).toEqual([
      { element: 1, bonus: 3 },
      { element: 2, bonus: 2 },
      { element: 3, bonus: 1 },
      { element: 4, bonus: 1 }
    ]);
  });

  it("prefers FPL's published bonus over BPS", () => {
    const side = (items: Array<[number, number]>) =>
      items.map(([elementId, value]) => ({ elementId, value, playerName: `P${elementId}`, teamShortName: "X" }));
    const fixture = {
      started: true,
      stats: [
        { key: "bps", label: "", home: side([[1, 50], [2, 10]]), away: side([[3, 30]]) },
        { key: "bonus", label: "", home: side([[2, 3]]), away: [] }
      ]
    } as Pick<LeagueFixture, "started" | "stats">;
    expect(fixtureBonusPreview(fixture)).toMatchObject({ status: "confirmed", items: [{ elementId: 2, bonus: 3, bps: 10 }] });
    expect(fixtureBonusPreview({ ...fixture, stats: fixture.stats.slice(0, 1) }).items.map((i) => i.elementId)).toEqual([1, 3, 2]);
    expect(fixtureBonusPreview({ ...fixture, started: false }).status).toBe("none");
  });
});

describe("rank movement", () => {
  it("lists climbers and fallers from last_rank to projected rank", () => {
    const summary = summarizeRankMovement([
      row(1, { lastRank: 3, projectedRank: 1, gwPoints: 80 }),
      row(2, { lastRank: 1, projectedRank: 2, gwPoints: 40 }),
      row(3, { lastRank: 2, projectedRank: 3, gwPoints: 30 }),
      row(4, { lastRank: null, projectedRank: 4 })
    ]);
    expect(summary.risers.map((m) => [m.entryId, m.delta])).toEqual([[1, 2]]);
    expect(summary.fallers.map((m) => m.entryId)).toEqual([2, 3]);
    expect(summary.topScorer?.managerName).toBe("M1");
    expect(summary.comparable).toBe(3);
  });

  it("computes the gap and XI differentials against a rival", () => {
    const me = row(1, { gwPoints: 50, projectedTotalPoints: 500, projectedRank: 2, squad: { starters: [p(1, 10, true), p(2, 5)], bench: [] } });
    const rival = row(2, { gwPoints: 60, projectedTotalPoints: 490, projectedRank: 3, squad: { starters: [p(1, 5), p(3, 8, true)], bench: [] } });
    const gap = computeRivalGap(me, rival);
    expect(gap).toMatchObject({ gwGap: -10, totalGap: 10, rankGap: 1, captainDiff: true });
    expect(gap.myOnly.map((x) => x.elementId)).toEqual([2]);
    expect(gap.rivalOnly.map((x) => x.elementId)).toEqual([3]);
  });
});

describe("recent leagues", () => {
  it("dedupes, keeps names and caps the list", () => {
    let list = addRecentLeague([], { id: 1, name: "A", viewedAt: 1 });
    list = addRecentLeague(list, { id: 2, name: null, viewedAt: 2 });
    list = addRecentLeague(list, { id: 1, name: null, viewedAt: 3 });
    expect(list.map((x) => [x.id, x.name])).toEqual([[1, "A"], [2, null]]);
    for (let i = 10; i < 20; i += 1) list = addRecentLeague(list, { id: i, name: null, viewedAt: i });
    expect(list).toHaveLength(6);
    expect(removeRecentLeague(list, 19).some((x) => x.id === 19)).toBe(false);
  });

  it("survives junk in storage", () => {
    expect(parseRecentLeagues("not json")).toEqual([]);
    expect(parseRecentLeagues('[{"id":-1},{"id":5,"name":3}]')).toEqual([{ id: 5, name: null, viewedAt: 0 }]);
  });
});

describe("price prediction log", () => {
  it("scores a snapshot against the actual moves", () => {
    const players = [
      { id: 1, webName: "A", priceLikelihood: 5, priceLockedUntil: null, priceChangePercent: 100, cost: 50 },
      { id: 2, webName: "B", priceLikelihood: -4, priceLockedUntil: null, priceChangePercent: -90, cost: 60 },
      { id: 3, webName: "C", priceLikelihood: 4, priceLockedUntil: null, priceChangePercent: 95, cost: 70 },
      { id: 4, webName: "D", priceLikelihood: 0, priceLockedUntil: null, priceChangePercent: 10, cost: 45 }
    ] as PlayerStat[];
    const at = "2026-10-30T00:00:00Z";
    const snapshot = buildSnapshot(players, at, new Date("2026-10-29T23:00:00Z"));
    expect(snapshot.predictions).toHaveLength(3);
    const ev = (playerId: number, before: number, after: number, changedAt = "2026-10-30T00:30:00Z") =>
      ({ playerId, costBefore: before, costAfter: after, changedAt }) as PriceChangeEvent;
    const score = evaluateSnapshot(snapshot, [ev(1, 50, 51), ev(2, 60, 61), ev(4, 45, 46), ev(3, 70, 71, "2026-10-20T00:30:00Z")]);
    expect(score).toMatchObject({ predicted: 3, hits: 1, wrongDirection: 1, noChange: 1, missed: 1 });
    expect(score.precision).toBeCloseTo(1 / 3);
  });
});
