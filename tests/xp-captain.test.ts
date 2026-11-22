import { describe, expect, it } from "vitest";
import { buildCaptainCandidates, captainWeights, CAPTAIN_TAU, percentShares, type CaptainInput } from "@/lib/xp/captain";

// Issue #43 stage 1-A: captain candidates and the "추천 비중" (a weight, not a probability).
const starter = (id: number, xp: number): CaptainInput => ({
  id,
  xp,
  fixtures: [{ opponent: "CHE", home: true }],
  selectedByPercent: 10
});

describe("percentShares", () => {
  it("always adds up to exactly 100, giving the leftover to the largest remainders", () => {
    expect(percentShares([1, 1, 1])).toEqual([34, 33, 33]);
    // 100 / 7 = 14.28: the two leftover points go to the earliest of the equal remainders.
    expect(percentShares([1, 1, 1, 1, 1, 1, 1])).toEqual([15, 15, 14, 14, 14, 14, 14]);
    for (const values of [[5, 3, 2], [0.2, 0.3, 0.5], [7, 1, 1, 1, 1], [1e-9, 1, 2]]) {
      expect(percentShares(values).reduce((a, b) => a + b, 0)).toBe(100);
    }
    expect(percentShares([60, 40])).toEqual([60, 40]);
  });

  it("returns zeros for an empty or all-zero input instead of NaN", () => {
    expect(percentShares([])).toEqual([]);
    expect(percentShares([0, 0])).toEqual([0, 0]);
  });
});

describe("captainWeights", () => {
  it("is exp(xP / tau) normalised, in whole percents summing to 100", () => {
    expect(CAPTAIN_TAU).toBe(1.5);
    const xps = [8, 6, 5, 4, 3];
    const raw = xps.map((xp) => Math.exp(xp / CAPTAIN_TAU));
    const total = raw.reduce((a, b) => a + b, 0);
    const weights = captainWeights(xps);
    expect(weights.reduce((a, b) => a + b, 0)).toBe(100);
    weights.forEach((weight, index) => {
      expect(Math.abs(weight - (raw[index] / total) * 100)).toBeLessThan(1);
    });
    // Larger xP never gets a smaller weight.
    expect([...weights].sort((a, b) => b - a)).toEqual(weights);
  });

  it("splits evenly for equal xP and survives a very large xP", () => {
    expect(captainWeights([4, 4, 4, 4, 4])).toEqual([20, 20, 20, 20, 20]);
    const huge = captainWeights([900, 1, 1]);
    expect(huge.reduce((a, b) => a + b, 0)).toBe(100);
    expect(huge[0]).toBe(100);
  });
});

describe("buildCaptainCandidates", () => {
  it("takes the five highest-xP starters, best first, with weights summing to 100", () => {
    const xi = [
      starter(1, 3), starter(2, 8), starter(3, 5), starter(4, 7), starter(5, 6),
      starter(6, 2), starter(7, 4), starter(8, 1), starter(9, 0.5), starter(10, 4.5), starter(11, 3.5)
    ];
    const captains = buildCaptainCandidates(xi);
    expect(captains.map((candidate) => candidate.id)).toEqual([2, 4, 5, 3, 10]);
    expect(captains.map((candidate) => candidate.rank)).toEqual([1, 2, 3, 4, 5]);
    expect(captains.reduce((sum, candidate) => sum + candidate.weightPct, 0)).toBe(100);
    expect(captains[0]).toMatchObject({ xp: 8, selectedByPercent: 10, fixtures: [{ opponent: "CHE", home: true }] });
    expect(captains[0].weightPct).toBeGreaterThan(captains[4].weightPct);
  });

  it("breaks equal xP by the lower player ID", () => {
    const captains = buildCaptainCandidates([starter(9, 5), starter(3, 5), starter(7, 5), starter(1, 5), starter(5, 5), starter(2, 5)]);
    expect(captains.map((candidate) => candidate.id)).toEqual([1, 2, 3, 5, 7]);
  });

  it("returns nothing without a starting XI", () => {
    expect(buildCaptainCandidates([])).toEqual([]);
  });
});
