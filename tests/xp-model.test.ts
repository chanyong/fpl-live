import { describe, expect, it } from "vitest";
import {
  XP_MODEL_VERSION,
  XP_PARAMS,
  buildXpTable,
  discountedSum,
  fixtureFactor,
  playChance,
  startRatio,
  type XpBootstrap,
  type XpElement,
  type XpFixtureRow
} from "@/lib/xp/model";

// Issue #43 stage 1-A: xP model xp1. The numbers are worked by hand from the constants in XP_PARAMS.
const NOW = Date.parse("2026-11-22T12:00:00Z");

function element(extra: Partial<XpElement> = {}): XpElement {
  return {
    id: 1,
    team: 1,
    element_type: 3,
    status: "a",
    form: 6,
    points_per_game: 4,
    starts: 10,
    chance_of_playing_next_round: null,
    selected_by_percent: 10,
    ...extra
  };
}

function bootstrap(elements: XpElement[], lastGw = 38): XpBootstrap {
  return {
    elements,
    teams: [
      { id: 1, short_name: "ARS" },
      { id: 2, short_name: "CHE" },
      { id: 3, short_name: "LIV" }
    ],
    events: Array.from({ length: lastGw }, (_, index) => ({
      id: index + 1,
      is_next: index + 1 === 12,
      // Gameweek 11's deadline is in the past (Nov 21), 12's a few days ahead, then weekly.
      deadline_time: new Date(Date.parse("2026-11-21T11:00:00Z") + (index - 10) * 7 * 86_400_000).toISOString()
    }))
  };
}

function game(event: number | null, home: number, away: number, hd = 3, ad = 3, finished = false): XpFixtureRow {
  return {
    event,
    team_h: home,
    team_a: away,
    team_h_difficulty: hd,
    team_a_difficulty: ad,
    finished,
    finished_provisional: finished
  };
}

/** Ten finished matches for team 1, so a player with 10 starts is a full regular (start ratio 1). */
function playedTen() {
  return Array.from({ length: 10 }, (_, index) => game(index + 1, 1, 2, 3, 3, true));
}

describe("xp1 building blocks", () => {
  it("maps FDR 1 and 2 to 1.15, 3 to 1.00, 4 to 0.88, 5 to 0.78, and home x1.05 / away x0.95", () => {
    expect(fixtureFactor(1, true)).toBeCloseTo(1.15 * 1.05);
    expect(fixtureFactor(2, false)).toBeCloseTo(1.15 * 0.95);
    expect(fixtureFactor(3, true)).toBeCloseTo(1.05);
    expect(fixtureFactor(4, false)).toBeCloseTo(0.88 * 0.95);
    expect(fixtureFactor(5, true)).toBeCloseTo(0.78 * 1.05);
    // Out-of-range values are clamped, never undefined/NaN.
    expect(fixtureFactor(0, true)).toBeCloseTo(1.15 * 1.05);
    expect(fixtureFactor(9, false)).toBeCloseTo(0.78 * 0.95);
  });

  it("takes FPL's chance when given, else the availability flag: a 1.0, d 0.5, i/s/u/n 0", () => {
    expect(playChance({ status: "d", chance_of_playing_next_round: 75 })).toBe(0.75);
    expect(playChance({ status: "a", chance_of_playing_next_round: 0 })).toBe(0);
    expect(playChance({ status: "a", chance_of_playing_next_round: null })).toBe(1);
    expect(playChance({ status: "d", chance_of_playing_next_round: null })).toBe(0.5);
    for (const status of ["i", "s", "u", "n"]) {
      expect(playChance({ status, chance_of_playing_next_round: null })).toBe(0);
    }
  });

  it("start ratio is starts over the team's finished matches, clamped to 0..1, and 1 with no matches", () => {
    expect(startRatio(6, 10)).toBe(0.6);
    expect(startRatio(12, 10)).toBe(1);
    expect(startRatio(0, 10)).toBe(0);
    expect(startRatio(5, 0)).toBe(1);
    expect(startRatio(null, 10)).toBe(1);
  });

  it("discounts far weeks 1.0, 0.9, 0.8, 0.7, 0.6, 0.5", () => {
    expect(XP_PARAMS.discount).toEqual([1.0, 0.9, 0.8, 0.7, 0.6, 0.5]);
    expect(discountedSum([5, 5, 5, 5, 5, 5], 3)).toBeCloseTo(5 * 2.7);
    expect(discountedSum([5, 5, 5, 5, 5, 5], 5)).toBeCloseTo(5 * 4.0);
    expect(discountedSum([2, 4], 3)).toBeCloseTo(2 + 3.6);
  });
});

describe("buildXpTable", () => {
  it("targets the first gameweek whose deadline is still ahead and covers six", () => {
    const table = buildXpTable(bootstrap([element()]), playedTen(), NOW)!;
    expect(table.modelVersion).toBe("xp1");
    expect(XP_MODEL_VERSION).toBe("xp1");
    expect(table.targetGw).toBe(12);
    expect(table.gws).toEqual([12, 13, 14, 15, 16, 17]);
  });

  it("shortens the horizon at the end of the season and returns null once no deadline is ahead", () => {
    const near = buildXpTable(bootstrap([element()], 14), playedTen(), NOW)!;
    expect(near.gws).toEqual([12, 13, 14]);
    expect(buildXpTable(bootstrap([element()], 11), playedTen(), NOW)).toBeNull();
  });

  it("xP of a fixture is availability x (0.5 form + 0.5 ppg) x fixture factor, with no extra appearance points", () => {
    // base = 0.5*6 + 0.5*4 = 5; Arsenal at home to Chelsea, FDR 2: 5 * 1.15 * 1.05.
    const table = buildXpTable(bootstrap([element()]), [...playedTen(), game(12, 1, 2, 2, 4)], NOW)!;
    const player = table.players.get(1)!;
    expect(player.base).toBe(5);
    expect(player.availability).toBe(1);
    expect(player.next).toBeCloseTo(5 * 1.15 * 1.05);
    expect(player.weeks[0].games).toEqual([expect.objectContaining({ opponent: "CHE", home: true, difficulty: 2 })]);
  });

  it("uses the away side's difficulty and factor for the away team", () => {
    const table = buildXpTable(bootstrap([element({ id: 2, team: 2, starts: null })]), [game(12, 1, 2, 2, 5)], NOW)!;
    // Chelsea away to Arsenal, FDR 5: 5 * 0.78 * 0.95.
    expect(table.players.get(2)!.next).toBeCloseTo(5 * 0.78 * 0.95);
  });

  it("sums a double gameweek and gives a blank gameweek 0", () => {
    const fixtures = [
      ...playedTen(),
      game(12, 1, 2, 3, 3),
      game(12, 3, 1, 3, 3), // Arsenal also away to Liverpool: a double
      game(14, 1, 3, 3, 3) // gameweek 13 is blank for Arsenal
    ];
    const player = buildXpTable(bootstrap([element()]), fixtures, NOW)!.players.get(1)!;
    expect(player.weeks[0].games).toHaveLength(2);
    expect(player.weeks[0].xp).toBeCloseTo(5 * 1.05 + 5 * 0.95);
    expect(player.weeks[1].xp).toBe(0);
    expect(player.weeks[1].games).toEqual([]);
    expect(player.weeks[2].xp).toBeCloseTo(5 * 1.05);
  });

  it("applies the play chance to the target gameweek only", () => {
    const fixtures = [...playedTen(), game(12, 1, 2), game(13, 1, 2)];
    const doubtful = element({ status: "d", chance_of_playing_next_round: 50 });
    const player = buildXpTable(bootstrap([doubtful]), fixtures, NOW)!.players.get(1)!;
    expect(player.playChance).toBe(0.5);
    expect(player.weeks[0].xp).toBeCloseTo(0.5 * 5 * 1.05);
    // The week after: back to the start ratio alone, however doubtful he is now.
    expect(player.weeks[1].xp).toBeCloseTo(5 * 1.05);
  });

  it("scales by the start ratio in every gameweek", () => {
    const rotated = element({ starts: 6 }); // 6 of Arsenal's 10 finished matches
    const fixtures = [...playedTen(), game(12, 1, 2), game(13, 1, 2)];
    const player = buildXpTable(bootstrap([rotated]), fixtures, NOW)!.players.get(1)!;
    expect(player.startRatio).toBe(0.6);
    expect(player.weeks[0].xp).toBeCloseTo(0.6 * 5 * 1.05);
    expect(player.weeks[1].xp).toBeCloseTo(0.6 * 5 * 1.05);
  });

  it("treats status u (left the league) as 0 for the whole horizon, even with a stale 100%", () => {
    const left = element({ status: "u", chance_of_playing_next_round: 100 });
    const fixtures = [...playedTen(), game(12, 1, 2), game(13, 1, 2)];
    const player = buildXpTable(bootstrap([left]), fixtures, NOW)!.players.get(1)!;
    expect(player.weeks.map((week) => week.xp)).toEqual([0, 0, 0, 0, 0, 0]);
    expect(player.sum3).toBe(0);
    expect(player.availability).toBe(0);
  });

  it("an injured player (i) is 0 next gameweek but counts again afterwards by his start ratio", () => {
    const injured = element({ status: "i", chance_of_playing_next_round: 0 });
    const fixtures = [...playedTen(), game(12, 1, 2), game(13, 1, 2)];
    const player = buildXpTable(bootstrap([injured]), fixtures, NOW)!.players.get(1)!;
    expect(player.weeks[0].xp).toBe(0);
    expect(player.weeks[1].xp).toBeCloseTo(5 * 1.05);
  });

  it("reports the discounted 3- and 5-gameweek sums", () => {
    const fixtures = [...playedTen(), ...[12, 13, 14, 15, 16, 17].map((gw) => game(gw, 1, 2))];
    const player = buildXpTable(bootstrap([element()]), fixtures, NOW)!.players.get(1)!;
    const each = 5 * 1.05;
    expect(player.sum3).toBeCloseTo(each * (1 + 0.9 + 0.8));
    expect(player.sum5).toBeCloseTo(each * (1 + 0.9 + 0.8 + 0.7 + 0.6));
  });

  it("carries price, form and tonight's price-change likelihood for the transfer search (0 when FPL sent none)", () => {
    const priced = element({ now_cost: 85, form: 7.5, price_change_projections: [{ offset: 1, likelihood: -5 }, { offset: 0, likelihood: 4 }] });
    const plain = element({ id: 2 });
    const table = buildXpTable(bootstrap([priced, plain]), [game(12, 1, 2)], NOW)!;
    expect(table.players.get(1)).toMatchObject({ nowCost: 85, form: 7.5, priceLikelihood: 4 });
    expect(table.players.get(2)).toMatchObject({ nowCost: 0, priceLikelihood: 0 });
  });

  it("ignores fixtures without a gameweek or outside the horizon", () => {
    const player = buildXpTable(bootstrap([element()]), [game(null, 1, 2), game(30, 1, 2)], NOW)!.players.get(1)!;
    expect(player.weeks.every((week) => week.games.length === 0)).toBe(true);
  });

  it("builds ~700 players x 6 gameweeks well inside one event-loop turn", () => {
    const elements = Array.from({ length: 700 }, (_, index) =>
      element({ id: index + 1, team: (index % 20) + 1, form: (index % 10) + 0.5, points_per_game: (index % 7) + 1, starts: index % 11 })
    );
    const teams = Array.from({ length: 20 }, (_, index) => ({ id: index + 1, short_name: `T${index + 1}` }));
    const fixtures: XpFixtureRow[] = [];
    for (let gw = 1; gw <= 38; gw += 1) {
      for (let match = 0; match < 10; match += 1) {
        fixtures.push(game(gw, match + 1, match + 11, (match % 5) + 1, ((match + 2) % 5) + 1, gw < 12));
      }
    }
    const started = performance.now();
    const table = buildXpTable({ ...bootstrap(elements), teams }, fixtures, NOW)!;
    const elapsed = performance.now() - started;
    console.info(`[xp perf] 700 players x ${table.gws.length} GW built in ${elapsed.toFixed(1)} ms`);
    expect(table.players.size).toBe(700);
    expect(elapsed).toBeLessThan(500);
  });
});
