import { describe, expect, it } from "vitest";
import { compareSquads } from "@/lib/squad-compare";
import type { FplPosition, LeagueRow, PlayerLiveCard } from "@/lib/types";

function card(elementId: number, position: FplPosition, livePoints = 2): PlayerLiveCard {
  return {
    elementId,
    webName: `P${elementId}`,
    teamShortName: "TST",
    teamCode: 1,
    position,
    livePoints,
    minutes: 90,
    status: "played",
    isCaptain: false,
    isViceCaptain: false,
    multiplier: 1,
    photoUrl: null
  };
}

function row(starters: PlayerLiveCard[], bench: PlayerLiveCard[]): LeagueRow {
  return { squad: { starters, bench } } as LeagueRow;
}

describe("compareSquads", () => {
  it("splits shared and exclusive players per position, bench included", () => {
    const a = row([card(1, "GKP"), card(2, "DEF"), card(3, "MID")], [card(4, "FWD")]);
    const b = row([card(1, "GKP"), card(5, "DEF"), card(3, "MID")], [card(6, "FWD")]);

    const result = compareSquads(a, b);
    const by = (position: FplPosition) => result.positions.find((group) => group.position === position)!;

    expect(by("GKP").shared.map((p) => p.elementId)).toEqual([1]);
    expect(by("DEF").onlyA.map((p) => p.elementId)).toEqual([2]);
    expect(by("DEF").onlyB.map((p) => p.elementId)).toEqual([5]);
    expect(by("MID").shared.map((p) => p.elementId)).toEqual([3]);
    expect(by("FWD").onlyA.map((p) => p.elementId)).toEqual([4]);
    expect(by("FWD").onlyB.map((p) => p.elementId)).toEqual([6]);
    expect(result.sharedCount).toBe(2);
    expect(result.onlyACount).toBe(2);
    expect(result.onlyBCount).toBe(2);
  });
});
