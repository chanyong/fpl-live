import { describe, expect, it } from "vitest";
import { priceOutlook, selectPricePredictions, selectRecentPriceChanges } from "@/lib/price-changes";
import type { PlayerStat } from "@/lib/types";

function player(webName: string, overrides: Partial<PlayerStat> = {}) {
  return { webName, projectedPercent: 0, costChangeEvent: 0, ...overrides } as PlayerStat;
}

describe("priceOutlook", () => {
  it("follows the 95 and 100 cuts in either direction", () => {
    expect(priceOutlook(100.1)).toBe("very-likely");
    expect(priceOutlook(-102.4)).toBe("very-likely");
    expect(priceOutlook(-95.8)).toBe("likely");
    expect(priceOutlook(94.9)).toBe("unlikely");
  });
});

describe("selectPricePredictions", () => {
  it("orders by size of the projected move regardless of direction", () => {
    const sorted = selectPricePredictions([
      player("a", { projectedPercent: 40 }),
      player("b", { projectedPercent: -99 }),
      player("c", { projectedPercent: 98 })
    ]);

    expect(sorted.map((row) => row.webName)).toEqual(["b", "c", "a"]);
  });
});

describe("selectRecentPriceChanges", () => {
  it("keeps only moved players and lists rises before falls of equal size", () => {
    const moved = selectRecentPriceChanges([
      player("still"),
      player("down", { costChangeEvent: -1 }),
      player("up", { costChangeEvent: 1 })
    ]);

    expect(moved.map((row) => row.webName)).toEqual(["up", "down"]);
  });
});
