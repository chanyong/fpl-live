import { describe, expect, it } from "vitest";
import { buildProvisionalBonusByElement, type FixtureWithStats } from "@/lib/league-aggregator";

type Bps = Array<[element: number, value: number]>;

function fixture(overrides: {
  id?: number;
  started?: boolean | null;
  finished?: boolean;
  finishedProvisional?: boolean;
  home?: Bps;
  away?: Bps;
  bonusHome?: Bps;
  bonusAway?: Bps;
}): FixtureWithStats {
  const toValues = (rows: Bps) => rows.map(([element, value]) => ({ element, value }));
  const stats: FixtureWithStats["stats"] = [
    { identifier: "bps", h: toValues(overrides.home ?? []), a: toValues(overrides.away ?? []) }
  ];

  if (overrides.bonusHome || overrides.bonusAway) {
    stats.push({
      identifier: "bonus",
      h: toValues(overrides.bonusHome ?? []),
      a: toValues(overrides.bonusAway ?? [])
    });
  }

  return {
    id: overrides.id ?? 1,
    event: 3,
    kickoff_time: null,
    team_h: 1,
    team_a: 2,
    team_h_score: null,
    team_a_score: null,
    started: overrides.started ?? true,
    finished: overrides.finished ?? false,
    finished_provisional: overrides.finishedProvisional ?? false,
    stats
  };
}

describe("buildProvisionalBonusByElement", () => {
  it("awards 3/2/1 down the BPS order", () => {
    const map = buildProvisionalBonusByElement([
      fixture({ home: [[10, 40], [11, 25]], away: [[20, 33]] })
    ]);

    expect(map.get(10)).toBe(3);
    expect(map.get(20)).toBe(2);
    expect(map.get(11)).toBe(1);
  });

  it("gives both leaders 3 and the next man 1 when the top is tied", () => {
    const map = buildProvisionalBonusByElement([
      fixture({ home: [[10, 40], [11, 40]], away: [[20, 30]] })
    ]);

    expect(map.get(10)).toBe(3);
    expect(map.get(11)).toBe(3);
    expect(map.get(20)).toBe(1);
  });

  it("gives both runners-up 2 and nobody 1 when second is tied", () => {
    const map = buildProvisionalBonusByElement([
      fixture({ home: [[10, 40], [11, 30]], away: [[20, 30], [21, 12]] })
    ]);

    expect(map.get(10)).toBe(3);
    expect(map.get(11)).toBe(2);
    expect(map.get(20)).toBe(2);
    expect(map.has(21)).toBe(false);
  });

  it("adds up across both halves of a double gameweek", () => {
    const map = buildProvisionalBonusByElement([
      fixture({ id: 1, home: [[10, 40]], away: [[20, 30], [21, 20]] }),
      fixture({ id: 2, home: [[10, 44]], away: [[30, 31], [31, 22]] })
    ]);

    expect(map.get(10)).toBe(6);
  });

  it("stays out of a fixture that has not kicked off", () => {
    const map = buildProvisionalBonusByElement([fixture({ started: false, home: [[10, 40]] })]);

    expect(map.size).toBe(0);
  });

  it("stays out of a fixture FPL has already settled", () => {
    const map = buildProvisionalBonusByElement([
      fixture({ finishedProvisional: true, home: [[10, 40]], away: [[20, 30]] })
    ]);

    expect(map.size).toBe(0);
  });

  // The bug: FPL publishes bonus into the fixture — and into event_points — before
  // `finished_provisional` flips, so estimating it again handed the player a second helping.
  it("stays out once FPL has published the fixture's own bonus", () => {
    const map = buildProvisionalBonusByElement([
      fixture({
        home: [[10, 40], [11, 25]],
        away: [[20, 33]],
        bonusHome: [[10, 3], [11, 1]],
        bonusAway: [[20, 2]]
      })
    ]);

    expect(map.size).toBe(0);
  });

  it("still estimates when the bonus rows are present but all zero", () => {
    const map = buildProvisionalBonusByElement([
      fixture({
        home: [[10, 40], [11, 25]],
        away: [[20, 33]],
        bonusHome: [[10, 0], [11, 0]],
        bonusAway: [[20, 0]]
      })
    ]);

    expect(map.get(10)).toBe(3);
  });

  it("keeps estimating the half of a double gameweek that is still in play", () => {
    const map = buildProvisionalBonusByElement([
      fixture({ id: 1, home: [[10, 40]], away: [[20, 30], [21, 20]], bonusHome: [[10, 3]] }),
      fixture({ id: 2, home: [[10, 44]], away: [[30, 31], [31, 22]] })
    ]);

    // Three from the settled fixture are already in his points; only the live three are ours.
    expect(map.get(10)).toBe(3);
  });
});
