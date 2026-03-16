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
      [7, { id: 7, webName: "Bench Mid", teamId: 7, elementType: 3, photo: "7.jpg" }],
      [8, { id: 8, webName: "Bench Fwd", teamId: 8, elementType: 4, photo: "8.jpg" }],
      [9, { id: 9, webName: "Bench Def", teamId: 9, elementType: 2, photo: "9.jpg" }],
      [10, { id: 10, webName: "Bench Keeper", teamId: 10, elementType: 1, photo: "10.jpg" }],
      [11, { id: 11, webName: "Def C", teamId: 11, elementType: 2, photo: "11.jpg" }],
      [12, { id: 12, webName: "Def D", teamId: 12, elementType: 2, photo: "12.jpg" }],
      [13, { id: 13, webName: "Mid C", teamId: 13, elementType: 3, photo: "13.jpg" }],
      [14, { id: 14, webName: "Fwd B", teamId: 14, elementType: 4, photo: "14.jpg" }],
      [15, { id: 15, webName: "Fwd C", teamId: 15, elementType: 4, photo: "15.jpg" }]
    ]),
    teamsById: new Map([
      [1, { id: 1, name: "Arsenal", shortName: "ARS" }],
      [2, { id: 2, name: "Aston Villa", shortName: "AVL" }],
      [3, { id: 3, name: "Bournemouth", shortName: "BOU" }],
      [4, { id: 4, name: "Brentford", shortName: "BRE" }],
      [5, { id: 5, name: "Brighton", shortName: "BHA" }],
      [6, { id: 6, name: "Chelsea", shortName: "CHE" }],
      [7, { id: 7, name: "Crystal Palace", shortName: "CRY" }],
      [8, { id: 8, name: "Everton", shortName: "EVE" }],
      [9, { id: 9, name: "Fulham", shortName: "FUL" }],
      [10, { id: 10, name: "Ipswich", shortName: "IPS" }],
      [11, { id: 11, name: "Leicester", shortName: "LEI" }],
      [12, { id: 12, name: "Liverpool", shortName: "LIV" }],
      [13, { id: 13, name: "Man City", shortName: "MCI" }],
      [14, { id: 14, name: "Man Utd", shortName: "MUN" }],
      [15, { id: 15, name: "Newcastle", shortName: "NEW" }]
    ]),
    liveByElementId: new Map([
      [1, { minutes: 90, totalPoints: 6 }],
      [2, { minutes: 90, totalPoints: 5 }],
      [3, { minutes: 0, totalPoints: 0 }],
      [4, { minutes: 60, totalPoints: 8 }],
      [5, { minutes: 20, totalPoints: 2 }],
      [6, { minutes: 90, totalPoints: 9 }],
      [7, { minutes: 30, totalPoints: 4 }],
      [8, { minutes: 25, totalPoints: 3 }],
      [9, { minutes: 90, totalPoints: 6 }],
      [10, { minutes: 90, totalPoints: 8 }],
      [11, { minutes: 90, totalPoints: 2 }],
      [12, { minutes: 90, totalPoints: 1 }],
      [13, { minutes: 90, totalPoints: 7 }],
      [14, { minutes: 90, totalPoints: 5 }],
      [15, { minutes: 0, totalPoints: 0 }]
    ]),
    fixturesByTeamId: new Map([
      [1, [{ id: 1, event: 30, teamH: 1, teamA: 21, started: true, finished: true, finishedProvisional: true }]],
      [2, [{ id: 2, event: 30, teamH: 2, teamA: 22, started: true, finished: true, finishedProvisional: true }]],
      [3, [{ id: 3, event: 30, teamH: 3, teamA: 23, started: true, finished: true, finishedProvisional: true }]],
      [4, [{ id: 4, event: 30, teamH: 4, teamA: 24, started: true, finished: false, finishedProvisional: false }]],
      [5, [{ id: 5, event: 30, teamH: 5, teamA: 25, started: true, finished: false, finishedProvisional: false }]],
      [6, [{ id: 6, event: 30, teamH: 6, teamA: 26, started: true, finished: true, finishedProvisional: true }]],
      [7, [{ id: 7, event: 30, teamH: 7, teamA: 27, started: true, finished: true, finishedProvisional: true }]],
      [8, [{ id: 8, event: 30, teamH: 8, teamA: 28, started: true, finished: true, finishedProvisional: true }]],
      [9, [{ id: 9, event: 30, teamH: 9, teamA: 29, started: true, finished: true, finishedProvisional: true }]],
      [10, [{ id: 10, event: 30, teamH: 10, teamA: 30, started: true, finished: true, finishedProvisional: true }]],
      [11, [{ id: 11, event: 30, teamH: 11, teamA: 31, started: true, finished: true, finishedProvisional: true }]],
      [12, [{ id: 12, event: 30, teamH: 12, teamA: 32, started: true, finished: true, finishedProvisional: true }]],
      [13, [{ id: 13, event: 30, teamH: 13, teamA: 33, started: true, finished: true, finishedProvisional: true }]],
      [14, [{ id: 14, event: 30, teamH: 14, teamA: 34, started: true, finished: true, finishedProvisional: true }]],
      [15, [{ id: 15, event: 30, teamH: 15, teamA: 35, started: true, finished: true, finishedProvisional: true }]]
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
  { element: 11, position: 7, multiplier: 1, isCaptain: false, isViceCaptain: false },
  { element: 12, position: 8, multiplier: 1, isCaptain: false, isViceCaptain: false },
  { element: 13, position: 9, multiplier: 1, isCaptain: false, isViceCaptain: false },
  { element: 14, position: 10, multiplier: 1, isCaptain: false, isViceCaptain: false },
  { element: 15, position: 11, multiplier: 1, isCaptain: false, isViceCaptain: false },
  { element: 10, position: 12, multiplier: 0, isCaptain: false, isViceCaptain: false },
  { element: 7, position: 13, multiplier: 0, isCaptain: false, isViceCaptain: false },
  { element: 8, position: 14, multiplier: 0, isCaptain: false, isViceCaptain: false },
  { element: 9, position: 15, multiplier: 0, isCaptain: false, isViceCaptain: false }
];

describe("scoring", () => {
  it("counts only effective starters whose fixture started or minutes > 0", () => {
    expect(
      computePlayersPlayed({
        picks: basePicks,
        chip: null,
        context: createContext()
      })
    ).toBe(9);
  });

  it("applies captain fallback and keeps live total separate from transfer hit", () => {
    const result = calculateLiveScore({
      picks: basePicks,
      chip: null,
      transferCost: 4,
      officialTotalBeforeLive: 1000,
      context: createContext()
    });

    expect(result.lineupPoints).toBe(53);
    expect(result.gwPoints).toBe(53);
    expect(result.totalPoints).toBe(1053);
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

    expect(result.gwPoints).toBe(63);
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

  it("falls back to bench autosubs after fixtures finish", () => {
    const finishedContext = {
      ...createContext(),
      fixturesByTeamId: new Map(
        [...createContext().fixturesByTeamId.entries()].map(([teamId, fixtures]) => [
          teamId,
          fixtures.map((fixture) => ({ ...fixture, finished: true, finishedProvisional: true }))
        ])
      )
    };

    const result = calculateLiveScore({
      picks: basePicks,
      automaticSubs: [],
      chip: null,
      transferCost: 0,
      officialTotalBeforeLive: 0,
      context: finishedContext
    });

    expect(result.gwPoints).toBe(60);
  });


  it("keeps original starters and bench in squad display while totals use autosubs", () => {
    const finishedContext = {
      ...createContext(),
      fixturesByTeamId: new Map(
        [...createContext().fixturesByTeamId.entries()].map(([teamId, fixtures]) => [
          teamId,
          fixtures.map((fixture) => ({ ...fixture, finished: true, finishedProvisional: true }))
        ])
      )
    };

    const squad = splitSquad(basePicks, null, finishedContext, []);

    expect(squad.starters.some((player) => player.webName === "Bench Mid")).toBe(false);
    expect(squad.starters.find((player) => player.webName === "Def B")?.livePoints).toBe(0);
    expect(squad.bench.find((player) => player.webName === "Bench Mid")?.livePoints).toBe(4);
    expect(squad.bench.find((player) => player.webName === "Bench Keeper")?.livePoints).toBe(8);
  });

});