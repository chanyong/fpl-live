import { describe, expect, it } from "vitest";
import { estimateFreeTransfers, transferCost, type TransferWeek } from "@/lib/free-transfers";

// Issue #39 stage 2. Rules (official rules page, 2026-11-22): 1 free transfer a week from the second
// gameweek, unused ones roll over (max 5), each extra transfer costs 4, and a Wildcard or Free Hit week
// leaves the stored count unchanged.
const quiet = (from: number, to: number): TransferWeek[] =>
  Array.from({ length: to - from + 1 }, (_, index) => ({ event: from + index, transfers: 0, cost: 0 }));

describe("estimateFreeTransfers", () => {
  it("has no figure before any gameweek is on record", () => {
    expect(estimateFreeTransfers({ weeks: [], chips: [], startedEvent: 1 }).free).toBeNull();
  });

  it("gives 1 after the first gameweek, since the first squad is free", () => {
    const result = estimateFreeTransfers({ weeks: quiet(1, 1), chips: [], startedEvent: 1 });
    expect(result.free).toBe(1);
    expect(result.matchesHistory).toBe(true);
  });

  it("rolls unused transfers over and stops at 5", () => {
    expect(estimateFreeTransfers({ weeks: quiet(1, 3), chips: [], startedEvent: 1 }).free).toBe(3);
    expect(estimateFreeTransfers({ weeks: quiet(1, 11), chips: [], startedEvent: 1 }).free).toBe(5);
  });

  it("uses transfers up, and a hit week leaves 1", () => {
    const weeks: TransferWeek[] = [
      { event: 1, transfers: 0, cost: 0 },
      { event: 2, transfers: 0, cost: 0 }, // 1 free in week 2, unused -> 2 for week 3
      { event: 3, transfers: 3, cost: 4 }, // 2 free, 3 made: one hit
      { event: 4, transfers: 1, cost: 0 } // 1 free, used -> 0 + 1
    ];
    const result = estimateFreeTransfers({ weeks, chips: [], startedEvent: 1 });
    expect(result.free).toBe(1);
    expect(result.matchesHistory).toBe(true);
  });

  it("reproduces a real manager's recorded costs (11 gameweeks, two hits)", () => {
    // Transfers and costs per week of a league-915874 team, read from the public API on 2026-11-22.
    const made = [0, 0, 3, 1, 0, 1, 1, 1, 3, 1, 0];
    const cost = [0, 0, 4, 0, 0, 0, 0, 0, 4, 0, 0];
    const weeks = made.map((transfers, index) => ({ event: index + 1, transfers, cost: cost[index] }));
    const result = estimateFreeTransfers({
      weeks,
      chips: [
        { name: "bboost", event: 1 },
        { name: "3xc", event: 3 }
      ],
      startedEvent: 1
    });
    expect(result.matchesHistory).toBe(true);
    expect(result.free).toBe(2);
  });

  it("keeps the stored count through a Wildcard or Free Hit week (no +1, no spend)", () => {
    const weeks: TransferWeek[] = [
      { event: 1, transfers: 0, cost: 0 },
      { event: 2, transfers: 0, cost: 0 },
      { event: 3, transfers: 0, cost: 0 }, // 3 free going into week 4
      { event: 4, transfers: 9, cost: 0 } // chip week
    ];
    const wildcard = estimateFreeTransfers({ weeks, chips: [{ name: "wildcard", event: 4 }], startedEvent: 1 });
    expect(wildcard.free).toBe(3);
    expect(wildcard.matchesHistory).toBe(true);
    const freeHit = estimateFreeTransfers({ weeks, chips: [{ name: "freehit", event: 4 }], startedEvent: 1 });
    expect(freeHit.free).toBe(3);
  });

  it("does not treat a Bench Boost or Triple Captain week as a transfer chip", () => {
    const result = estimateFreeTransfers({ weeks: quiet(1, 4), chips: [{ name: "bboost", event: 4 }], startedEvent: 1 });
    expect(result.free).toBe(4);
  });

  it("starts counting the week after a mid-season joiner's first squad", () => {
    // Joined in gameweek 6: that squad is free whatever the record says; one stored transfer for week 7.
    const weeks = [{ event: 6, transfers: 0, cost: 0 }, ...quiet(7, 8)];
    expect(estimateFreeTransfers({ weeks, chips: [], startedEvent: 6 }).free).toBe(3);
  });

  it("flags a history it cannot reproduce", () => {
    const weeks: TransferWeek[] = [
      { event: 1, transfers: 0, cost: 0 },
      { event: 2, transfers: 1, cost: 4 } // one transfer, one free, yet 4 points recorded
    ];
    const result = estimateFreeTransfers({ weeks, chips: [], startedEvent: 1 });
    expect(result.matchesHistory).toBe(false);
    expect(result.firstMismatchEvent).toBe(2);
  });

  it("treats a gameweek the manager skipped as 'no transfers'", () => {
    const weeks = [
      { event: 1, transfers: 0, cost: 0 },
      { event: 4, transfers: 0, cost: 0 }
    ];
    expect(estimateFreeTransfers({ weeks, chips: [], startedEvent: 1 }).free).toBe(4);
  });
});

describe("transferCost", () => {
  it("charges 4 points for every transfer beyond the free ones", () => {
    expect(transferCost(0, 1)).toBe(0);
    expect(transferCost(2, 2)).toBe(0);
    expect(transferCost(3, 1)).toBe(8);
  });
});
