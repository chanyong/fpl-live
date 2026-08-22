import { describe, expect, it } from "vitest";
import { getCurrentGw } from "@/lib/gameweek";

const event = (id: number, is_current: boolean, finished: boolean) => ({ id, is_current, finished });

describe("getCurrentGw", () => {
  it("returns the in-progress gameweek", () => {
    expect(getCurrentGw([event(1, false, true), event(2, true, false), event(3, false, false)])).toBe(2);
  });

  it("keeps the current gameweek after it finishes", () => {
    expect(getCurrentGw([event(1, false, true), event(2, true, true), event(3, false, false)])).toBe(2);
  });

  it("falls back to the last finished gameweek when none is current", () => {
    expect(getCurrentGw([event(1, false, true), event(2, false, true), event(3, false, false)])).toBe(2);
  });

  it("falls back to the first gameweek before the season starts", () => {
    expect(getCurrentGw([event(1, false, false), event(2, false, false)])).toBe(2);
  });

  it("survives an empty event list", () => {
    expect(getCurrentGw([])).toBe(1);
  });
});
