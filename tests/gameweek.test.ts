import { describe, expect, it } from "vitest";
import { getCurrentGw, getNextDeadline } from "@/lib/gameweek";

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

describe("getNextDeadline", () => {
  const now = Date.parse("2026-10-18T00:00:00Z");
  const dated = (id: number, deadline_time: string, is_next = false) => ({ id, deadline_time, is_next });

  it("prefers the gameweek FPL flags as next", () => {
    expect(
      getNextDeadline(
        [dated(7, "2026-10-10T17:30:00Z"), dated(8, "2026-10-23T17:30:00Z", true), dated(9, "2026-10-31T17:30:00Z")],
        now
      )
    ).toEqual({ gw: 8, deadlineTime: "2026-10-23T17:30:00Z" });
  });

  it("falls back to the first future deadline and never returns a past one", () => {
    expect(getNextDeadline([dated(7, "2026-10-10T17:30:00Z"), dated(8, "2026-10-23T17:30:00Z")], now)?.gw).toBe(8);
    expect(getNextDeadline([dated(7, "2026-10-10T17:30:00Z")], now)).toBeNull();
  });
});
