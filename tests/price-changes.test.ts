import { describe, expect, it } from "vitest";
import {
  daysUntilUnlock,
  matchesDirection,
  ownershipTrend,
  priceStatus,
  selectPricePredictions,
  selectRecentPriceChanges
} from "@/lib/price-changes";
import type { PlayerStat, PriceChangeEvent } from "@/lib/types";

function player(webName: string, overrides: Partial<PlayerStat> = {}) {
  return {
    webName,
    priceChangePercent: 0,
    projectedPercent: 0,
    priceLockedUntil: null,
    transfersInEvent: 0,
    transfersOutEvent: 0,
    ...overrides
  } as PlayerStat;
}

function change(webName: string, changedAt: string) {
  return { webName, changedAt, costBefore: 50, costAfter: 49 } as PriceChangeEvent;
}

describe("priceStatus", () => {
  it("reads FPL's likelihood exactly as the official page does", () => {
    expect(priceStatus(5)).toBe("very-likely-rise");
    expect(priceStatus(4)).toBe("likely-rise");
    expect(priceStatus(-4)).toBe("likely-drop");
    expect(priceStatus(-5)).toBe("very-likely-drop");
    expect(priceStatus(1)).toBe("no-change");
    expect(priceStatus(0)).toBe("no-change");
  });
});

describe("selectPricePredictions", () => {
  it("orders by size of the current progress regardless of direction", () => {
    const sorted = selectPricePredictions([
      player("a", { priceChangePercent: 40, projectedPercent: 120 }),
      player("b", { priceChangePercent: -121.8 }),
      player("c", { priceChangePercent: 111.8 })
    ]);

    expect(sorted.map((row) => row.webName)).toEqual(["b", "c", "a"]);
  });
});

describe("matchesDirection", () => {
  it("splits on the sign of progress and keeps locked players apart", () => {
    const riser = player("up", { priceChangePercent: 3 });
    const locked = player("lock", { priceChangePercent: -3, priceLockedUntil: "2099-01-01T00:00:00Z" });

    expect(matchesDirection(riser, "rise")).toBe(true);
    expect(matchesDirection(riser, "drop")).toBe(false);
    expect(matchesDirection(locked, "drop")).toBe(true);
    expect(matchesDirection(locked, "locked")).toBe(true);
    expect(matchesDirection(riser, "locked")).toBe(false);
  });
});

describe("daysUntilUnlock", () => {
  it("rounds part days up", () => {
    const now = Date.parse("2026-10-25T00:00:00Z");

    expect(daysUntilUnlock("2026-10-26T06:00:00Z", now)).toBe(2);
    expect(daysUntilUnlock("2026-10-24T00:00:00Z", now)).toBe(0);
  });
});

describe("selectRecentPriceChanges", () => {
  it("lists the newest moves first and same-time moves alphabetically", () => {
    const sorted = selectRecentPriceChanges([
      change("Gusto", "2026-10-23T23:00:09Z"),
      change("Hume", "2026-10-24T23:00:09Z"),
      change("Aaronson", "2026-10-24T23:00:09Z")
    ]);

    expect(sorted.map((row) => row.webName)).toEqual(["Aaronson", "Hume", "Gusto"]);
  });
});

describe("ownershipTrend", () => {
  it("compares this gameweek's transfers in and out", () => {
    expect(ownershipTrend(player("a", { transfersInEvent: 10, transfersOutEvent: 3 }))).toBe("up");
    expect(ownershipTrend(player("b", { transfersInEvent: 1, transfersOutEvent: 3 }))).toBe("down");
    expect(ownershipTrend(player("c", { transfersInEvent: 2, transfersOutEvent: 2 }))).toBeNull();
  });
});
