import { describe, expect, it } from "vitest";
import {
  calculateLiveScore,
  computePlayersPlayed,
  computeProjectedRanks,
  splitSquad,
  type ScoringContext
} from "@/lib/scoring";
import type { Pick } from "@/lib/types";

function createContext(): ScoringContext {
  return {
    elementsById: new Map([
      [1, { id: 1, webName: "Keeper", teamId: 1, elementType: 1, photo: "1.jpg" }],
      [2, { id: 2, webName: "Def A", teamId: 2, elementType: 2, photo: "2.jpg" }],
      [3, { id: 3, webName: "Def B", teamId: 3, elementType: 2, photo: "3.jpg" }],
      [4, { id: 4, webName: "Mid A", teamId: 4, elementType: 3, photo: "4.jpg" }],
      [5, { id: 5, webName: "Mid B", teamId: 5, elementType: 3, photo: "5.jpg" }],
      [6, { id: 6, webName: "Fwd A", teamId: 6, elementType: 4, photo: "6.jpg" }],
      [7, { id: 7, webName: "Bench Mid", teamId: 7, elementType: 3, photo: "7.jpg" }]
    ]),
    teamsById: new Map([
      [1, { id: 1, shortName: "ARS" }],
      [2, { id: 2, shortName: "AVL" }],
      [3, { id: 3, shortName: "BOU" }],
      [4, { id: 4, shortName: "BRE" }],
      [5, { id: 5, shortName: "BHA" }],
      [6, { id: 6, shortName: "CHE" }],
      [7, { id: 7, shortName: "CRY" }]
    ]),
    liveByElementId: new Map([
      [1, { minutes: 90, totalPoints: 6 }],
      [2, { minutes: 90, totalPoints: 5 }],
      [3, { minutes: 0, totalPoints: 0 }],
      [4, { minutes: 60, totalPoints: 8 }],
      [5, { minutes: 20, totalPoints: 2 }],
      [6, { minutes: 90, totalPoints: 9 }],
      [7, { minutes: 30, totalPoints: 4 }]
    ]),
    fixturesByTeamId: new Map([
      [1, [{ id: 1, event: 30, teamH: 1, teamA: 11, started: true, finished: true, finishedProvisional: true }]],
      [2, [{ id: 2, event: 30, teamH: 2, teamA: 12, started: true, finished: true, finishedProvisional: true }]],
      [3, [{ id: 3, event: 30, teamH: 3, teamA: 13, started: true, finished: true, finishedProvisional: true }]],
      [4, [{ id: 4, event: 30, teamH: 4, teamA: 14, started: true, finished: false, finishedProvisional: false }]],
      [5, [{ id: 5, event: 30, teamH: 5, teamA: 15, started: true, finished: false, finishedProvisional: false }]],
      [6, [{ id: 6, event: 30, teamH: 6, teamA: 16, started: true, finished: true, finishedProvisional: true }]],
      [7, [{ id: 7, event: 30, teamH: 7, teamA: 17, started: true, finished: true, finishedProvisional: true }]]
    ])
  };
}

const basePicks: Pick[] = [
  { element: 1, position: 1, multiplier: 1, isCaptain: false, isViceCaptain: false },
  { element: 2, position: 2, multiplier: 1, isCaptain: false, isViceCaptain: false },
  { element: 3, position: 3, multiplier: 1, isCaptain: true, isViceCaptain: false },
  { element: 4, position: 4, multiplier: 1, isCaptain: false, isViceCaptain: true },
  { element: 5, position: 5, multiplier: 1, isCaptain: false, isViceCaptain: false },
  { element: 6, position: 6, multiplier: 1, isCaptain: false, isViceCaptain: false },
  { element: 7, position: 12, multiplier: 0, isCaptain: false, isViceCaptain: false }
];

describe("scoring", () => {
  it("counts only starting players whose fixture started or minutes > 0", () => {
    expect(computePlayersPlayed(basePicks, createContext())).toBe(5);
  });

  it("applies captain fallback and transfer hit", () => {
    const result = calculateLiveScore({
      picks: basePicks,
      chip: null,
      transferCost: 4,
      officialTotalBeforeLive: 1000,
      context: createContext()
    });

    expect(result.lineupPoints).toBe(38);
    expect(result.gwPoints).toBe(34);
    expect(result.totalPoints).toBe(1034);
    expect(result.provisional).toBe(true);
  });

  it("applies triple captain multiplier", () => {
    const picks = basePicks.map((pick) => ({
      ...pick,
      isCaptain: pick.element === 6,
      isViceCaptain: pick.element === 4
    }));

    const result = calculateLiveScore({
      picks,
      chip: "3xc",
      transferCost: 0,
      officialTotalBeforeLive: 100,
      context: createContext()
    });

    expect(result.gwPoints).toBe(48);
  });

  it("computes projected ranks using live totals with stable tie-break", () => {
    const ranked = computeProjectedRanks([
      { rank: 3, totalPoints: 110 },
      { rank: 1, totalPoints: 130 },
      { rank: 2, totalPoints: 110 }
    ]);

    expect(ranked.map((row) => row.projectedRank)).toEqual([3, 1, 2]);
  });

  it("shows captain-adjusted points in the squad cards", () => {
    const squad = splitSquad(basePicks, null, createContext());

    expect(squad.starters.find((player) => player.webName === "Mid A")?.livePoints).toBe(16);
    expect(squad.starters.find((player) => player.webName === "Def B")?.livePoints).toBe(0);
  });
});


