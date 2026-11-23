import { describe, expect, it } from "vitest";
import { buildPublicFootball, buildPublicPlayers, parsePublicGw, publicCurrentGw } from "@/lib/public-football";
import { bootstrapFixture, fixturesFixture } from "./helpers/public-fpl";

// Issue #33 stage 2: league-free data for /premier-league, /fixtures and /players.
const EVENTS = [
  { id: 9, finished: true },
  { id: 10, is_current: true },
  { id: 11, is_next: true },
  { id: 12 },
  { id: 13 }
];

const FIXTURES = fixturesFixture([
  { id: 1, event: 9, kickoff_time: "2026-11-01T14:00:00Z", team_h: 1, team_a: 2, team_h_score: 2, team_a_score: 0, started: true, finished: true, finished_provisional: true },
  { id: 3, event: 10, kickoff_time: "2026-11-08T16:30:00Z", team_h: 3, team_a: 4 },
  { id: 2, event: 10, kickoff_time: "2026-11-08T14:00:00Z", team_h: 1, team_a: 3, team_h_score: 1, team_a_score: 1, started: true, minutes: 63 },
  { id: 4, event: 10, kickoff_time: null, team_h: 2, team_a: 4 },
  { id: 5, event: 11, kickoff_time: "2026-11-15T14:00:00Z", team_h: 2, team_a: 1, team_h_score: 5, team_a_score: 5 },
  { id: 6, event: 14, kickoff_time: "2026-11-29T14:00:00Z", team_h: 2, team_a: 1 },
  { id: 7, event: null, kickoff_time: null, team_h: 3, team_a: 2 }
]);

describe("publicCurrentGw", () => {
  it("follows the shared current-gameweek rule once the season is under way", () => {
    expect(publicCurrentGw(bootstrapFixture(EVENTS).events)).toBe(10);
  });

  it("falls back to the first gameweek before the season opens instead of the last", () => {
    expect(publicCurrentGw(bootstrapFixture([{ id: 1 }, { id: 2 }, { id: 38 }]).events)).toBe(1);
  });
});

describe("buildPublicFootball", () => {
  const data = buildPublicFootball(bootstrapFixture(EVENTS), FIXTURES);

  it("builds the Premier League table from the results, a match in play included", () => {
    expect(data.table.map((row) => [row.position, row.shortName, row.points])).toEqual([
      [1, "ARS", 4],
      [2, "LIV", 1],
      [3, "EVE", 0],
      [4, "CHE", 0]
    ]);
  });

  it("lists the current gameweek's fixtures in the league screen's shape, ordered by kickoff with undated matches last", () => {
    expect(data.gw).toBe(10);
    expect(data.fixtures.map((fixture) => fixture.id)).toEqual([2, 3, 4]);
    expect(data.fixtures[0]).toMatchObject({ homeShortName: "ARS", awayShortName: "LIV", homeScore: 1, awayScore: 1, started: true, minutes: 63 });
  });

  it("lists another gameweek on request, clamped to the season, and tells where the season starts and ends", () => {
    const next = buildPublicFootball(bootstrapFixture(EVENTS), FIXTURES, 11);
    expect(next.gw).toBe(11);
    expect(next.fixtures.map((fixture) => fixture.id)).toEqual([5]);
    expect([next.firstGw, next.lastGw, next.currentGw]).toEqual([9, 13, 10]);
    expect(buildPublicFootball(bootstrapFixture(EVENTS), FIXTURES, 30).gw).toBe(10);
  });

  it("reads the gameweek from the address only when it is a whole number from 1 to 38", () => {
    expect(parsePublicGw("12")).toBe(12);
    expect(parsePublicGw(["7", "8"])).toBe(7);
    for (const bad of [undefined, "", "0", "39", "abc", "1.5", "-3"]) {
      expect(parsePublicGw(bad)).toBeNull();
    }
  });

  it("drops the score of a match that has not started", () => {
    // A placeholder score before kickoff must not read as a result.
    const upcoming = buildPublicFootball(bootstrapFixture(EVENTS), FIXTURES, 11).fixtures[0];
    expect(upcoming).toMatchObject({ started: false, homeScore: null, awayScore: null });
  });

  it("feeds the team fixture table: current gameweek, one crest code per team and the upcoming fixtures", () => {
    expect(data.teamOutlook.league.currentGw).toBe(10);
    expect(data.teamOutlook.players).toContainEqual({ teamShortName: "ARS", teamCode: 3 });
    expect(data.teamOutlook.outlook.ARS.map((fixture) => [fixture.gw, fixture.opponent, fixture.home])).toEqual([
      [11, "CHE", false],
      [14, "CHE", false]
    ]);
  });
});

describe("buildPublicPlayers", () => {
  const data = buildPublicPlayers(bootstrapFixture(EVENTS), FIXTURES);

  it("keeps players who have played, best season score first", () => {
    expect(data.players.map((player) => player.webName)).toEqual(["Palmer", "Saka"]);
  });

  it("carries the gameweeks and the next fixtures for the difficulty strip", () => {
    expect(data.currentGw).toBe(10);
    expect(data.nextGw).toBe(11);
    expect(data.fdr.CHE.map((fixture) => fixture.gw)).toEqual([11, 14]);
  });

  it("reads transfers for the in/out chart", () => {
    expect(data.players.find((player) => player.webName === "Saka")?.netTransfers).toBe(80000);
  });
});
