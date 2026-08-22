import { describe, expect, it } from "vitest";
import { hasFixtureEnded, isFixtureInPlay } from "@/lib/fixture-status";

const fixture = (started: boolean, finished: boolean, finishedProvisional: boolean) => ({
  started,
  finished,
  finishedProvisional
});

describe("hasFixtureEnded", () => {
  it("treats a provisionally finished match as over", () => {
    // FPL flips finished_provisional at the whistle and finished only once
    // bonus points are confirmed, sometimes hours later.
    expect(hasFixtureEnded(fixture(true, false, true))).toBe(true);
  });

  it("treats a confirmed finished match as over", () => {
    expect(hasFixtureEnded(fixture(true, true, true))).toBe(true);
  });

  it("does not treat a match in play as over", () => {
    expect(hasFixtureEnded(fixture(true, false, false))).toBe(false);
  });

  it("does not treat an unstarted match as over", () => {
    expect(hasFixtureEnded(fixture(false, false, false))).toBe(false);
  });
});

describe("isFixtureInPlay", () => {
  it("is true only while the match is running", () => {
    expect(isFixtureInPlay(fixture(true, false, false))).toBe(true);
  });

  it("is false at the final whistle even before bonus is confirmed", () => {
    expect(isFixtureInPlay(fixture(true, false, true))).toBe(false);
  });

  it("is false before kickoff", () => {
    expect(isFixtureInPlay(fixture(false, false, false))).toBe(false);
  });
});
