import { describe, expect, it } from "vitest";
import { buildManagerSeason, formatMoney } from "@/lib/season-summary";
import type { ChipDefinition, EntryHistoryPayload, EntryHistoryRow } from "@/lib/types";

// The 2026/27 inventory: every chip is granted once per half of the season.
const CHIPS: ChipDefinition[] = [
  { name: "wildcard", start: 2, stop: 19 },
  { name: "freehit", start: 2, stop: 19 },
  { name: "bboost", start: 1, stop: 19 },
  { name: "3xc", start: 1, stop: 19 },
  { name: "wildcard", start: 20, stop: 38 },
  { name: "freehit", start: 20, stop: 38 },
  { name: "bboost", start: 20, stop: 38 },
  { name: "3xc", start: 20, stop: 38 }
];

function history(overrides: Partial<EntryHistoryPayload> = {}): EntryHistoryPayload {
  return { current: [], chips: [], past: [], ...overrides };
}

function week(event: number, extra: Partial<EntryHistoryRow> = {}): EntryHistoryRow {
  return {
    event,
    points: 50,
    total_points: 50 * event,
    overall_rank: 1_000_000,
    bank: 5,
    value: 1000,
    event_transfers: 0,
    event_transfers_cost: 0,
    points_on_bench: 0,
    ...extra
  };
}

describe("buildManagerSeason chips", () => {
  it("counts every chip as available before any is played", () => {
    const season = buildManagerSeason(history(), CHIPS, 1);

    expect(season.chipsRemaining).toBe(8);
    expect(season.chips.every((chip) => chip.usedEvent === null)).toBe(true);
  });

  it("marks a played chip against the window it falls in", () => {
    const season = buildManagerSeason(history({ chips: [{ name: "bboost", event: 1 }] }), CHIPS, 1);

    expect(season.chips.find((chip) => chip.name === "bboost" && chip.start === 1)?.usedEvent).toBe(1);
    expect(season.chips.find((chip) => chip.name === "bboost" && chip.start === 20)?.usedEvent).toBeNull();
    expect(season.chipsRemaining).toBe(7);
  });

  it("consumes the second-half grant when the chip is played after the reset", () => {
    const season = buildManagerSeason(history({ chips: [{ name: "wildcard", event: 25 }] }), CHIPS, 25);

    expect(season.chips.find((chip) => chip.name === "wildcard" && chip.start === 20)?.usedEvent).toBe(25);
    expect(season.chips.find((chip) => chip.name === "wildcard" && chip.start === 2)?.usedEvent).toBeNull();
  });

  it("does not double-consume when the same chip is played in both halves", () => {
    const season = buildManagerSeason(
      history({ chips: [{ name: "3xc", event: 5 }, { name: "3xc", event: 30 }] }),
      CHIPS,
      30
    );

    const played = season.chips
      .filter((chip) => chip.name === "3xc" && chip.usedEvent !== null)
      .map((chip) => chip.usedEvent);

    expect(played).toEqual([5, 30]);
  });

  it("expires an unused chip once its window has passed", () => {
    const season = buildManagerSeason(history(), CHIPS, 22);

    expect(season.chips.find((chip) => chip.name === "wildcard" && chip.start === 2)?.expired).toBe(true);
    // Four first-half chips expired; the four second-half grants are still in hand.
    expect(season.chipsRemaining).toBe(4);
  });

  it("labels chips in Korean and keeps a stable order", () => {
    const season = buildManagerSeason(history(), CHIPS, 1);

    expect(season.chips[0].label).toBe("벤치 부스트");
    expect(season.chips.map((chip) => chip.name).slice(0, 4)).toEqual([
      "bboost",
      "3xc",
      "wildcard",
      "freehit"
    ]);
  });
});

describe("buildManagerSeason totals", () => {
  it("sums bench points, transfers and hits across the season", () => {
    const season = buildManagerSeason(
      history({
        current: [
          week(1, { points_on_bench: 6 }),
          week(2, { points_on_bench: 11, event_transfers: 3, event_transfers_cost: 8 }),
          week(3, { points_on_bench: 2, event_transfers: 1, value: 1013, bank: 7 })
        ]
      }),
      CHIPS,
      3
    );

    expect(season.pointsOnBench).toBe(19);
    expect(season.transfers).toBe(4);
    expect(season.transferCost).toBe(8);
    expect(season.squadValue).toBe(1013);
    expect(season.bank).toBe(7);
  });

  it("reads overall rank from the latest gameweek", () => {
    const season = buildManagerSeason(
      history({ current: [week(1, { overall_rank: 900_000 }), week(2, { overall_rank: 420_000 })] }),
      CHIPS,
      2
    );

    expect(season.overallRank).toBe(420_000);
  });

  it("survives a manager with no history at all", () => {
    const season = buildManagerSeason(history(), CHIPS, 1);

    expect(season.pointsOnBench).toBe(0);
    expect(season.squadValue).toBeNull();
    expect(season.overallRank).toBeNull();
    expect(season.pastSeasons).toEqual([]);
  });

  it("carries past seasons through", () => {
    const season = buildManagerSeason(
      history({ past: [{ season_name: "2020/21", total_points: 1700, rank: 5_295_089 }] }),
      CHIPS,
      1
    );

    expect(season.pastSeasons).toEqual([
      { seasonName: "2020/21", totalPoints: 1700, rank: 5_295_089 }
    ]);
  });
});

describe("formatMoney", () => {
  it("renders tenths of a million as FPL shows them", () => {
    expect(formatMoney(1000)).toBe("£100.0m");
    expect(formatMoney(7)).toBe("£0.7m");
    expect(formatMoney(null)).toBe("-");
  });
});
