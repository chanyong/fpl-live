import { describe, expect, it } from "vitest";
import { parseGw, parseLeagueId } from "@/lib/request-params";

describe("parseLeagueId", () => {
  it("accepts a positive integer", () => {
    expect(parseLeagueId("822501")).toEqual({ leagueId: 822501 });
  });

  it("rejects missing, non-numeric, and non-positive values", () => {
    expect(parseLeagueId(null)).toHaveProperty("error");
    expect(parseLeagueId("abc")).toHaveProperty("error");
    expect(parseLeagueId("0")).toHaveProperty("error");
    expect(parseLeagueId("-5")).toHaveProperty("error");
    expect(parseLeagueId("1.5")).toHaveProperty("error");
  });
});

describe("parseGw", () => {
  it("defaults to current", () => {
    expect(parseGw(null)).toEqual({ gw: "current" });
    expect(parseGw("current")).toEqual({ gw: "current" });
  });

  it("accepts a gameweek in range", () => {
    expect(parseGw("38")).toEqual({ gw: "38" });
  });

  it("rejects out-of-range and non-numeric values", () => {
    expect(parseGw("0")).toHaveProperty("error");
    expect(parseGw("39")).toHaveProperty("error");
    expect(parseGw("abc")).toHaveProperty("error");
  });
});
