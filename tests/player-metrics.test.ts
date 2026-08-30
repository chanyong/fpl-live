import { describe, expect, it } from "vitest";
import {
  availability,
  differentialSwing,
  effectiveOwnership,
  percent,
  roundTo,
  topBy
} from "@/lib/player-metrics";

describe("effectiveOwnership", () => {
  it("counts starters once and captains twice", () => {
    // 11 of 15 field him and 5 of those captain him.
    expect(effectiveOwnership({ starters: 11, captains: 5, managerCount: 15 })).toBeCloseTo(106.67, 1);
  });

  it("ignores benched owners, because a bench never scores", () => {
    expect(effectiveOwnership({ starters: 4, captains: 0, managerCount: 10 })).toBe(40);
  });

  it("survives an empty league instead of dividing by zero", () => {
    expect(effectiveOwnership({ starters: 0, captains: 0, managerCount: 0 })).toBe(0);
  });
});

describe("differentialSwing", () => {
  it("is worth the full score when nobody else owns him", () => {
    expect(differentialSwing(20, 0)).toBe(20);
  });

  it("moves nobody when the whole league owns him", () => {
    expect(differentialSwing(20, 100)).toBe(0);
  });

  it("gives half the score at half ownership", () => {
    expect(differentialSwing(12, 50)).toBe(6);
  });

  it("goes negative past 100% effective ownership, where owning was not enough", () => {
    // Everyone fields him and some captain him: a plain owner loses ground.
    expect(differentialSwing(10, 140)).toBeCloseTo(-4, 5);
  });

  it("keeps the sign of a negative score", () => {
    expect(differentialSwing(-2, 0)).toBe(-2);
  });

  it("is the full score for a solo owner in a fifteen-manager league", () => {
    // One manager fields him, nobody captains him: EO is 1/15.
    const eo = effectiveOwnership({ starters: 1, captains: 0, managerCount: 15 });
    expect(roundTo(differentialSwing(13, eo))).toBe(12.1);
  });
});

describe("percent", () => {
  it("returns zero rather than NaN when there is nothing to divide by", () => {
    expect(percent(3, 0)).toBe(0);
  });

  it("reports a share of the whole", () => {
    expect(percent(3, 15)).toBe(20);
  });
});

describe("topBy", () => {
  const rows = [
    { name: "a", value: 5 },
    { name: "b", value: 0 },
    { name: "c", value: 12 },
    { name: "d", value: -3 }
  ];

  it("ranks highest first and drops the zero and negative tail", () => {
    expect(topBy(rows, (row) => row.value, 5).map((row) => row.name)).toEqual(["c", "a"]);
  });

  it("honours the limit", () => {
    expect(topBy(rows, (row) => row.value, 1).map((row) => row.name)).toEqual(["c"]);
  });

  it("leaves the input untouched", () => {
    topBy(rows, (row) => row.value, 5);
    expect(rows.map((row) => row.name)).toEqual(["a", "b", "c", "d"]);
  });
});

describe("availability", () => {
  it("names each FPL status flag in Korean", () => {
    expect(availability("i").label).toBe("부상");
    expect(availability("d").tone).toBe("warn");
    expect(availability("s").tone).toBe("out");
  });

  it("falls back to available for an unknown flag", () => {
    expect(availability("?").label).toBe("출전 가능");
  });
});

describe("roundTo", () => {
  it("keeps one decimal by default", () => {
    expect(roundTo(106.6666)).toBe(106.7);
    expect(roundTo(-4.25)).toBe(-4.2);
  });
});
