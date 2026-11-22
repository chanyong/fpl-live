import { describe, expect, it } from "vitest";
import { purchasePrices, sellingPrice } from "@/lib/selling-price";

// Issue #39 stage 2: price paid plus half the rise (rounded down to 0.1m); a fall is paid in full.
describe("sellingPrice", () => {
  it("keeps half of a rise, rounded down to 0.1m", () => {
    expect(sellingPrice(100, 100)).toBe(100);
    expect(sellingPrice(100, 101)).toBe(100);
    expect(sellingPrice(100, 102)).toBe(101);
    expect(sellingPrice(100, 105)).toBe(102);
    expect(sellingPrice(61, 70)).toBe(65);
  });

  it("pays a fallen price out in full", () => {
    expect(sellingPrice(50, 40)).toBe(40);
  });
});

describe("purchasePrices", () => {
  const buy = (element_in: number, element_in_cost: number, event: number, time: string) => ({
    element_in,
    element_in_cost,
    element_out: 999,
    event,
    time
  });

  it("takes the most recent transfer in for a player", () => {
    const prices = purchasePrices([buy(5, 60, 3, "a"), buy(5, 70, 8, "b")], new Set());
    expect(prices.get(5)).toBe(70);
  });

  it("separates two buys in the same gameweek by time", () => {
    const prices = purchasePrices([buy(5, 60, 3, "2026-10-01T10:00"), buy(5, 65, 3, "2026-10-02T10:00")], new Set());
    expect(prices.get(5)).toBe(65);
  });

  it("ignores transfers made in a Free Hit gameweek", () => {
    const prices = purchasePrices([buy(5, 60, 3, "a"), buy(5, 80, 7, "b"), buy(6, 55, 7, "c")], new Set([7]));
    expect(prices.get(5)).toBe(60);
    expect(prices.has(6)).toBe(false);
  });
});
