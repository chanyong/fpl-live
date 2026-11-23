import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getEntrySquad = vi.hoisted(() => vi.fn());
const getBase = vi.hoisted(() => vi.fn());
vi.mock("@/lib/entry-squad", async (importActual) => ({
  ...(await importActual<typeof import("@/lib/entry-squad")>()),
  getEntrySquad
}));
vi.mock("@/lib/public-data", () => ({ getBase }));
// Issue #47: these tests are about what the route computes, not who may ask. The own-team guard has its own tests
// (tests/own-team-guard.test.ts), so here it lets the request through.
vi.mock("@/lib/journal/own-team", async (importActual) => ({
  ...(await importActual<typeof import("@/lib/journal/own-team")>()),
  checkOwnTeam: async () => "ok"
}));

import { GET } from "@/app/api/entry-recommend/route";
import { resetEntryRequestLimits } from "@/lib/entry-request-limit";
import { EntryBusyError, EntryNotFoundError, FplUnavailableError } from "@/lib/entry-squad";
import type { EntrySquadPayload, SquadPlayer } from "@/lib/squad-types";
import { buildXpTable, type XpBootstrap, type XpElement, type XpFixtureRow } from "@/lib/xp/model";
import { buildChipExplanations, chipModeNote, chipPickReason } from "@/lib/xp/chip-explain";
import { buildEntryRecommend, buildScenarioLineups, buildScenarioPlayerInfo } from "@/lib/xp/recommend";
import type { TransferSearchResult } from "@/lib/xp/transfer-search";
import { getXpTable, resetXpTableCache } from "@/lib/xp/xp-table";

// Issue #43 stage 1-A: /api/entry-recommend assembles the squad and the shared xP table, no FPL call of its own.
const NOW = Date.parse("2026-11-22T12:00:00Z");

const el = (id: number, team: number, type: number, form: number, ppg: number, extra: Partial<XpElement> = {}): XpElement => ({
  id,
  team,
  element_type: type,
  status: "a",
  form,
  points_per_game: ppg,
  starts: null,
  chance_of_playing_next_round: null,
  selected_by_percent: id,
  ...extra
});

// 2 GK, 5 DEF, 5 MID, 3 FWD; ids 1-2 GK, 11-15 DEF, 21-25 MID, 31-33 FWD. MID 21 is the star, MID 25 is injured.
const elements: XpElement[] = [
  el(1, 1, 1, 4, 4), el(2, 2, 1, 2, 2),
  el(11, 1, 2, 5, 5), el(12, 1, 2, 4, 4), el(13, 2, 2, 3, 3), el(14, 2, 2, 2, 2), el(15, 3, 2, 1, 1),
  el(21, 1, 3, 9, 9), el(22, 2, 3, 6, 6), el(23, 3, 3, 5, 5), el(24, 3, 3, 3, 3),
  el(25, 3, 3, 8, 8, { status: "i", chance_of_playing_next_round: 0 }),
  el(31, 1, 4, 7, 7), el(32, 2, 4, 4, 4), el(33, 3, 4, 2, 2)
];

const xpBootstrap: XpBootstrap = {
  elements,
  teams: [
    { id: 1, short_name: "ARS" },
    { id: 2, short_name: "CHE" },
    { id: 3, short_name: "LIV" }
  ],
  events: [
    { id: 11, deadline_time: "2026-11-21T11:00:00Z" },
    { id: 12, is_next: true, deadline_time: "2026-11-27T18:30:00Z" },
    { id: 13, deadline_time: "2026-12-04T18:30:00Z" }
  ]
};

const fixtures: XpFixtureRow[] = [
  { event: 12, team_h: 1, team_a: 2, team_h_difficulty: 2, team_a_difficulty: 4, finished: false, finished_provisional: false },
  { event: 13, team_h: 3, team_a: 1, team_h_difficulty: 3, team_a_difficulty: 3, finished: false, finished_provisional: false }
];

function squadPlayer(element: XpElement, pickPosition: number): SquadPlayer {
  return {
    elementId: element.id,
    webName: `P${element.id}`,
    teamShortName: "ARS",
    teamCode: 3,
    position: ({ 1: "GKP", 2: "DEF", 3: "MID", 4: "FWD" } as const)[element.element_type as 1 | 2 | 3 | 4],
    pickPosition,
    isStarter: pickPosition <= 11,
    isCaptain: false,
    isViceCaptain: false,
    photoUrl: null,
    status: element.status,
    news: "",
    nowCost: 50,
    purchaseCost: 50,
    sellingPrice: 50,
    costChangeEvent: 0,
    costChangeStart: 0,
    form: element.form,
    selectedByPercent: element.selected_by_percent,
    eventPoints: null,
    fixtures: []
  };
}

// The manager plays injured MID 25 and benches star MID 21.
const pickOrder = [1, 11, 12, 13, 14, 22, 23, 24, 25, 31, 32, 2, 21, 15, 33];
const squadPayload = (): EntrySquadPayload =>
  ({
    entryId: 5,
    teamName: "Test FC",
    managerName: "A B",
    gw: 11,
    bank: 0,
    chips: [],
    transfers: { freeTransfers: 1, freeTransfersMatchHistory: true, lastGwTransfers: 0, lastGwCost: 0, pendingTransfers: 0 },
    squad: pickOrder.map((id, index) => squadPlayer(elements.find((item) => item.id === id)!, index + 1)),
    fetchedAt: NOW
  }) as unknown as EntrySquadPayload;

describe("buildEntryRecommend", () => {
  const table = buildXpTable(xpBootstrap, fixtures, NOW)!;
  const result = buildEntryRecommend(squadPayload(), table);

  it("labels the target gameweek, the squad gameweek and the model", () => {
    expect(result).toMatchObject({ entryId: 5, modelVersion: "xp1", targetGw: 12, squadGw: 11, squadFetchedAt: NOW, xpBuiltAt: NOW });
    expect(result.players).toHaveLength(15);
    expect(result.assumptions.map((item) => item.code)).toContain("squad_last_deadline");
  });

  it("gives each of the 15 their xP, availability and the opponent of the target gameweek", () => {
    const star = result.players.find((player) => player.elementId === 21)!;
    expect(star.xpNext).toBeCloseTo(9 * 1.15 * 1.05);
    expect(star.nextFixtures).toEqual([{ opponent: "CHE", home: true, difficulty: 2 }]);
    const injured = result.players.find((player) => player.elementId === 25)!;
    expect(injured.xpNext).toBe(0);
    expect(injured.availability).toBe(0);
    // Liverpool have no fixture in gameweek 12: a blank.
    expect(result.players.find((player) => player.elementId === 15)!.nextFixtures).toEqual([]);
  });

  it("recommends dropping the injured starter for the benched star and shows it as an out/in pair", () => {
    const [best] = result.lineups;
    expect(best.starters).toContain(21);
    expect(best.starters).not.toContain(25);
    // LIV has no fixture in gameweek 12 (blank), so more than one slot moves; the injured one is among those out.
    expect(best.changes.map((change) => change.out)).toContain(25);
    expect(best.changes.map((change) => change.in)).toContain(21);
    expect(best.gain).toBeGreaterThan(0);
    expect(result.lineups.length).toBeGreaterThanOrEqual(2);
  });

  it("proposes five captains from the recommended XI, star first, weights adding to 100", () => {
    expect(result.captains).toHaveLength(5);
    expect(result.captains[0].id).toBe(21);
    expect(result.captains.reduce((sum, candidate) => sum + candidate.weightPct, 0)).toBe(100);
    const starters = new Set(result.lineups[0].starters);
    expect(result.captains.every((candidate) => starters.has(candidate.id))).toBe(true);
  });

  it("answers with empty candidates for a team with no squad yet", () => {
    const empty = buildEntryRecommend({ ...squadPayload(), gw: null, squad: [] }, table);
    expect(empty).toMatchObject({ squadGw: null, players: [], lineups: [], captains: [] });
  });
});

describe("getXpTable memo", () => {
  beforeEach(() => {
    resetXpTableCache();
    getBase.mockReset().mockResolvedValue({ bootstrap: xpBootstrap, fixtures });
  });

  it("builds once for ten minutes and rebuilds afterwards", async () => {
    const first = await getXpTable(NOW);
    expect(await getXpTable(NOW + 9 * 60_000)).toBe(first);
    expect(getBase).toHaveBeenCalledTimes(1);
    expect(await getXpTable(NOW + 11 * 60_000)).not.toBe(first);
    expect(getBase).toHaveBeenCalledTimes(2);
  });

  it("is null when FPL did not answer and nothing is cached", async () => {
    getBase.mockResolvedValue(null);
    expect(await getXpTable(NOW)).toBeNull();
  });
});

describe("GET /api/entry-recommend", () => {
  const req = (query: string, ip = "9.9.9.9") =>
    new NextRequest(`http://localhost/api/entry-recommend${query}`, { headers: { "x-forwarded-for": ip } });

  beforeEach(() => {
    resetEntryRequestLimits();
    resetXpTableCache();
    getEntrySquad.mockReset().mockResolvedValue(squadPayload());
    getBase.mockReset().mockResolvedValue({ bootstrap: xpBootstrap, fixtures });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  it("answers 400 for a missing or malformed team ID without loading anything", async () => {
    for (const query of ["", "?entryId=abc", "?entryId=-1", "?entryId=1e3", "?entryId=../x"]) {
      expect((await GET(req(query))).status).toBe(400);
    }
    expect(getEntrySquad).not.toHaveBeenCalled();
  });

  it("returns the recommendation uncached for browsers, with no FPL call beyond squad + base", async () => {
    const response = await GET(req("?entryId=5"));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.json();
    expect(body).toMatchObject({ entryId: 5, modelVersion: "xp1", targetGw: 12, squadGw: 11 });
    expect(body.lineups[0].starters).toHaveLength(11);
    expect(body.captains).toHaveLength(5);
    expect(getEntrySquad).toHaveBeenCalledWith(5, false);
    // getBase is the memoised bootstrap read: the xP table and the scenario names share it, none of the three readers (xP table, scenario names, scenario lineups) calls FPL itself.
    expect(getBase.mock.calls.length).toBeLessThanOrEqual(3);
  });

  it("passes refresh=1 on as a forced refresh of the squad", async () => {
    await GET(req("?entryId=5&refresh=1"));
    expect(getEntrySquad).toHaveBeenCalledWith(5, true);
  });

  it("maps an unknown team to 404, an FPL outage (squad or xP table) to 502, anything else to 500", async () => {
    getEntrySquad.mockRejectedValueOnce(new EntryNotFoundError());
    expect((await GET(req("?entryId=6"))).status).toBe(404);
    getEntrySquad.mockRejectedValueOnce(new FplUnavailableError());
    expect((await GET(req("?entryId=7"))).status).toBe(502);
    resetXpTableCache();
    getBase.mockResolvedValue(null);
    expect((await GET(req("?entryId=8"))).status).toBe(502);
    getEntrySquad.mockRejectedValueOnce(new Error("boom"));
    expect((await GET(req("?entryId=9"))).status).toBe(500);
  });

  it("adds a playerInfo object for the players the scenarios move", async () => {
    const body = await (await GET(req("?entryId=5"))).json();
    expect(body.playerInfo).toBeTypeOf("object");
    expect(body.playerInfo).not.toBeNull();
  });

  it("answers 503 with Retry-After when too many teams are being loaded at once", async () => {
    getEntrySquad.mockRejectedValueOnce(new EntryBusyError(5));
    const response = await GET(req("?entryId=10"));
    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("5");
    expect(await response.json()).toMatchObject({ retryAfterSeconds: 5 });
  });

  it("stops an IP that walks through team IDs with 429 and Retry-After, but not another visitor", async () => {
    for (let id = 1; id <= 12; id += 1) {
      expect((await GET(req(`?entryId=${id}`))).status).toBe(200);
    }
    const blocked = await GET(req("?entryId=13"));
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get("retry-after"))).toBeGreaterThan(0);
    expect((await GET(req("?entryId=13", "8.8.8.8"))).status).toBe(200);
  });
});

describe("buildScenarioPlayerInfo", () => {
  const table = buildXpTable(xpBootstrap, fixtures, NOW)!;
  const transfers = {
    scenarios: [
      { id: "roll", type: "roll", out: [], in: [] },
      { id: "one:25>21", type: "one", out: [25], in: [21] },
      { id: "wildcard", type: "wildcard", out: [11, 25], in: [21, 31] }
    ]
  } as unknown as TransferSearchResult;

  beforeEach(() => {
    getBase.mockReset().mockResolvedValue({
      bootstrap: { ...xpBootstrap, elements: elements.map((element) => ({ ...element, web_name: `Name${element.id}` })) },
      fixtures
    });
  });

  it("gives every player a scenario moves a display name, club, position and current price, from the shared bootstrap", async () => {
    const info = await buildScenarioPlayerInfo(transfers, table);
    expect(Object.keys(info).sort()).toEqual(["11", "21", "25", "31"]);
    expect(info["21"]).toEqual({ webName: "Name21", teamShortName: "ARS", position: "MID", nowCost: table.players.get(21)!.nowCost });
    expect(info["31"].position).toBe("FWD");
  });

  it("is empty without scenarios, and falls back to nothing (not an error) when the bootstrap is unavailable", async () => {
    expect(await buildScenarioPlayerInfo(null, table)).toEqual({});
    getBase.mockResolvedValue(null);
    expect(await buildScenarioPlayerInfo(transfers, table)).toEqual({});
  });
});

describe("buildScenarioLineups (issue #61)", () => {
  const table = buildXpTable(xpBootstrap, fixtures, NOW)!;
  const squadIds = [1, 2, 11, 12, 13, 14, 15, 21, 22, 23, 24, 25, 31, 32, 33];
  const squad = {
    entryId: 5,
    gw: 11,
    fetchedAt: NOW,
    squad: squadIds.map((id, index) => ({
      elementId: id,
      webName: `Own${id}`,
      teamShortName: "ARS",
      teamCode: 0,
      position: ({ 1: "GKP", 2: "DEF", 3: "MID", 4: "FWD" } as const)[table.players.get(id)!.elementType as 1 | 2 | 3 | 4],
      isStarter: index < 11,
      status: "a",
      news: "",
      photoUrl: null
    }))
  } as unknown as EntrySquadPayload;
  const transfers = {
    scenarios: [
      { id: "roll", type: "roll", out: [], in: [] },
      { id: "one:25>21x", type: "one", out: [25], in: [] }
    ]
  } as unknown as TransferSearchResult;

  beforeEach(() => {
    getBase.mockReset().mockResolvedValue({ bootstrap: { ...xpBootstrap, elements }, fixtures });
  });

  it("roll equals the recommended lineup and captain of the current squad", async () => {
    const { scenarioLineups } = await buildScenarioLineups(squad, transfers, table);
    const base = buildEntryRecommend(squad, table);
    expect(scenarioLineups.roll.starters).toEqual(base.lineups[0].starters);
    expect(scenarioLineups.roll.bench).toEqual(base.lineups[0].bench);
    expect(scenarioLineups.roll.formation).toBe(base.lineups[0].formation);
    expect(scenarioLineups.roll.captainId).toBe(base.captains[0].id);
    expect(scenarioLineups.roll.viceCaptainId).toBe(base.captains[1].id);
  });

  it("keeps 11 starters, 4 bench, legal positions and no outgoing player for a transfer", async () => {
    // A 16th player (id 41, MID, owned by nobody) comes in for defender 13.
    const extra = { ...xpBootstrap, elements: [...elements, el(41, 1, 3, 10, 10, { web_name: "Newman", photo: "99.jpg" } as Partial<XpElement>)] };
    const bigTable = buildXpTable(extra, fixtures, NOW)!;
    getBase.mockResolvedValue({ bootstrap: extra, fixtures });
    const swap = { scenarios: [{ id: "one:13>41", type: "one", out: [13], in: [41] }] } as unknown as TransferSearchResult;
    const { scenarioLineups, lineupPlayers } = await buildScenarioLineups(squad, swap, bigTable);
    const lineup = scenarioLineups["one:13>41"];
    expect(lineup.starters).toHaveLength(11);
    expect(lineup.bench).toHaveLength(4);
    expect([...lineup.starters, ...lineup.bench]).not.toContain(13);
    expect(new Set([...lineup.starters, ...lineup.bench]).size).toBe(15);
    expect(lineup.incoming).toEqual([41]);
    const types = lineup.starters.map((id) => bigTable.players.get(id)!.elementType);
    expect(types.filter((type) => type === 1)).toHaveLength(1);
    expect(types.filter((type) => type === 2).length).toBeGreaterThanOrEqual(3);
    expect(types.filter((type) => type === 3).length).toBeGreaterThanOrEqual(2);
    expect(types.filter((type) => type === 4).length).toBeGreaterThanOrEqual(1);
    expect(lineup.starters).toContain(41);
    expect(lineup.starters).toContain(lineup.captainId);
    expect(lineupPlayers["41"].fixtures.length).toBeGreaterThan(0);
    expect(lineupPlayers["41"].photoUrl).toContain("p99.png");
  });

  it("is empty without scenarios", async () => {
    expect(await buildScenarioLineups(squad, null, table)).toEqual({ scenarioLineups: {}, lineupPlayers: {} });
  });
});

describe("chip explanations (issue #69)", () => {
  const table = buildXpTable(xpBootstrap, fixtures, NOW)!;
  const squad = squadPayload();
  // Wildcard / Free Hit bring MID 22,23 in for owned defenders 14,15 and FWD 32 for FWD 33 (ids from the squad / table above).
  const chip = (type: "wildcard" | "freehit", horizon: 3 | 5) =>
    ({
      horizon,
      scenarios: [{ id: type, type, out: [24, 33], in: [21, 32], nextGwXp: 0, periodXp: 0, transferCost: 0, netGain: 5, bankAfter: 0, optimal: false }]
    }) as unknown as TransferSearchResult;
  const lineups = { wildcard: { starters: [21], captainId: 21, viceCaptainId: 32 }, freehit: { starters: [21], captainId: 21, viceCaptainId: null } };

  it("lists exactly the incoming players with the table's xP, fixtures and a same-position pairing", () => {
    const result = buildChipExplanations(squad, chip("wildcard", 3), table, lineups)["wildcard"];
    expect(result.picks.map((pick) => pick.id).sort()).toEqual([21, 32]);
    const mid = result.picks.find((pick) => pick.id === 21)!;
    expect(mid.xpNext).toBe(table.players.get(21)!.next);
    expect(mid.xpPeriod).toBe(table.players.get(21)!.sum3);
    expect(mid.position).toBe("MID");
    expect(mid.replacesId).toBe(24);
    expect(mid.replacesXpNext).toBe(table.players.get(24)!.next);
    expect(mid.fixtures).toEqual(table.players.get(21)!.weeks[0].games.map((g) => ({ opponent: g.opponent, home: g.home, difficulty: g.difficulty })));
    expect(mid.role).toBe("C");
    expect(result.picks.find((pick) => pick.id === 32)!.role).toBe("V");
    expect(result.picks.find((pick) => pick.id === 32)!.replacesId).toBe(33);
    // grouped by position order: MID before FWD
    expect(result.picks.map((pick) => pick.position)).toEqual(["MID", "FWD"]);
  });

  it("uses the 5-GW sum for a 5-GW horizon and skips non-chip scenarios", () => {
    const five = buildChipExplanations(squad, chip("wildcard", 5), table, lineups)["wildcard"];
    expect(five.horizon).toBe(5);
    expect(five.picks.find((pick) => pick.id === 21)!.xpPeriod).toBe(table.players.get(21)!.sum5);
    const mixed = { horizon: 3, scenarios: [{ id: "one:24>21", type: "one", out: [24], in: [21] }] } as unknown as TransferSearchResult;
    expect(buildChipExplanations(squad, mixed, table, {})).toEqual({});
    expect(buildChipExplanations(squad, null, table, {})).toEqual({});
  });

  it("words Free Hit as this-week-only and Wildcard by the period, and the figures match the pick", () => {
    const names = (id: number) => `N${id}`;
    const fh = buildChipExplanations(squad, chip("freehit", 3), table, lineups)["freehit"];
    const wc = buildChipExplanations(squad, chip("wildcard", 3), table, lineups)["wildcard"];
    const fhLine = chipPickReason(fh.picks[0], "freehit", 3, "ko", names);
    const wcLine = chipPickReason(wc.picks[0], "wildcard", 3, "ko", names);
    expect(fhLine).toContain("이번 주 기대 " + fh.picks[0].xpNext.toFixed(1));
    expect(fhLine).not.toContain("다음 3GW");
    expect(wcLine).toContain("다음 3GW 기대 " + wc.picks[0].xpPeriod.toFixed(1));
    expect(wcLine).toContain("N24 대신");
    expect(wcLine).toContain("캡틴 후보");
    expect(chipModeNote("freehit", 3, "ko")).toContain("다음 주에는 원래 팀으로");
    expect(chipModeNote("wildcard", 5, "ko")).toContain("다음 5GW");
    expect(chipModeNote("freehit", 3, "en")).toContain("this week only");
  });
});
