import { getNextDeadline } from "@/lib/gameweek";

/**
 * Expected points (xP), first model, "xp1" (issue #43, stage 1-A). Rules only, no AI, no stored history.
 *
 * Per player and per fixture:
 *
 *   xP(fixture) = availability x base x fixtureFactor
 *   availability = playChance x startRatio
 *   base         = 0.5 x form + 0.5 x points_per_game
 *   fixtureFactor = FDR factor x home/away factor
 *
 * Deliberate difference from the plan's formula (`... + 2 x availability` appearance points): `form` and
 * `points_per_game` are averages of points already scored, and those points include the 2 for playing 60+
 * minutes. Adding 2 x availability on top counted the appearance twice and lifted every regular starter by
 * about two points regardless of the opponent. xp1 therefore does not add it; the 2nd model (per-90 xG/xA
 * build-up) is where appearance points get their own term.
 *
 * A double gameweek sums its fixtures, a blank gameweek is 0. The result is a table of every player x the next
 * six gameweeks, pure data: the same input always gives the same table.
 */
export const XP_MODEL_VERSION = "xp1";

/** Every tunable number of xp1 lives here. They are starting values, not fitted; the backtest tunes them. */
export const XP_PARAMS = {
  /** How many gameweeks the table covers, starting with the target gameweek. */
  horizonGws: 6,
  /** Weights of form and points_per_game in the base expectation. */
  formWeight: 0.5,
  pointsPerGameWeight: 0.5,
  /** Fixture difficulty (FDR) -> factor. 1 and 2 share the easiest band; anything outside 1..5 is clamped. */
  fdrFactor: { 1: 1.15, 2: 1.15, 3: 1.0, 4: 0.88, 5: 0.78 } as Record<number, number>,
  homeFactor: 1.05,
  awayFactor: 0.95,
  /** Play chance from the availability flag when FPL gives no `chance_of_playing_next_round`. */
  statusPlayChance: { a: 1.0, d: 0.5, i: 0, s: 0, u: 0, n: 0 } as Record<string, number>,
  /** Unknown flag (not one of the above): treated as available. */
  unknownStatusPlayChance: 1.0,
  /** Flag that removes the player for the whole horizon, not only the next gameweek (left the league). */
  goneStatus: "u",
  /** Weight of the 1st, 2nd ... gameweek when xP is summed over a horizon (far weeks are less certain). */
  discount: [1.0, 0.9, 0.8, 0.7, 0.6, 0.5],
  /** Horizons (in gameweeks) published next to the next-gameweek xP. 3 is the default (decision D-7). */
  sumHorizons: [3, 5] as const
} as const;

export type XpElement = {
  id: number;
  team: number;
  element_type: number;
  status: string;
  form: number;
  points_per_game: number;
  /** Matches started this season; null when FPL did not send it (then the start ratio is 1). */
  starts: number | null;
  /** FPL's % chance of playing the next gameweek; null when it gives none. */
  chance_of_playing_next_round: number | null;
  selected_by_percent: number;
};

export type XpFixtureRow = {
  event: number | null;
  team_h: number;
  team_a: number;
  team_h_difficulty: number;
  team_a_difficulty: number;
  finished: boolean;
  finished_provisional: boolean;
};

export type XpBootstrap = {
  elements: XpElement[];
  teams: Array<{ id: number; short_name: string }>;
  events: Array<{ id: number; is_next?: boolean; deadline_time?: string | null }>;
};

export type XpGameXp = { opponentTeamId: number; opponent: string; home: boolean; difficulty: number; xp: number };
export type XpGameweekXp = { gw: number; xp: number; games: XpGameXp[] };

export type XpPlayer = {
  id: number;
  teamId: number;
  /** FPL element_type: 1 GK, 2 DEF, 3 MID, 4 FWD. */
  elementType: number;
  status: string;
  /** Overall ownership, percent. */
  selectedByPercent: number;
  /** 0.5 x form + 0.5 x points_per_game. */
  base: number;
  /** Share of the team's finished matches the player started, 0..1. */
  startRatio: number;
  /** Chance of playing the target gameweek, 0..1 (FPL's figure or the status default). */
  playChance: number;
  /** playChance x startRatio for the target gameweek; the table's "출전 계수". */
  availability: number;
  /** One entry per covered gameweek, the target gameweek first. */
  weeks: XpGameweekXp[];
  /** xP of the target gameweek. */
  next: number;
  /** Discounted sum over the first 3 and the first 5 gameweeks. */
  sum3: number;
  sum5: number;
};

export type XpTable = {
  modelVersion: typeof XP_MODEL_VERSION;
  /** First gameweek whose deadline has not passed; the table starts here. */
  targetGw: number;
  /** ISO time of that deadline, if FPL gave one. */
  targetDeadline: string | null;
  /** Gameweeks covered, e.g. [12..17]. Fewer than six near the end of the season. */
  gws: number[];
  builtAt: number;
  players: Map<number, XpPlayer>;
};

function clamp(value: number, low: number, high: number) {
  return Math.min(high, Math.max(low, value));
}

export function fixtureFactor(difficulty: number, home: boolean) {
  const band = clamp(Math.round(difficulty), 1, 5);
  return XP_PARAMS.fdrFactor[band] * (home ? XP_PARAMS.homeFactor : XP_PARAMS.awayFactor);
}

/** Chance (0..1) of playing the next gameweek: FPL's own percentage, else what the availability flag implies. */
export function playChance(element: Pick<XpElement, "status" | "chance_of_playing_next_round">) {
  if (element.chance_of_playing_next_round !== null && element.chance_of_playing_next_round !== undefined) {
    return clamp(element.chance_of_playing_next_round / 100, 0, 1);
  }
  return XP_PARAMS.statusPlayChance[element.status] ?? XP_PARAMS.unknownStatusPlayChance;
}

export function startRatio(starts: number | null, teamMatchesPlayed: number) {
  // No finished matches yet (season start) or no figure from FPL: assume a regular.
  if (starts === null || teamMatchesPlayed <= 0) {
    return 1;
  }
  return clamp(starts / teamMatchesPlayed, 0, 1);
}

/** Sum of the first `count` weekly values with the far-week discount (1.0, 0.9, 0.8 ...). */
export function discountedSum(values: number[], count: number) {
  let sum = 0;
  for (let index = 0; index < Math.min(count, values.length); index += 1) {
    sum += values[index] * (XP_PARAMS.discount[index] ?? XP_PARAMS.discount[XP_PARAMS.discount.length - 1]);
  }
  return sum;
}

/** The gameweek the table is for: the first one whose deadline is still ahead. Null once the season is over. */
export function targetGameweek(events: XpBootstrap["events"], now: number) {
  return getNextDeadline(events, now);
}

type SideFixture = { opponentTeamId: number; home: boolean; difficulty: number };

/**
 * xP of every player for the target gameweek and the five after it.
 *
 * `playChance` (FPL's `chance_of_playing_next_round`) only applies to the target gameweek: beyond it the
 * player is judged by his start ratio alone, because FPL gives no return date (the 2nd model reads the news
 * text). Status "u" (left the league) is 0 for the whole horizon.
 */
export function buildXpTable(bootstrap: XpBootstrap, fixtures: XpFixtureRow[], now: number): XpTable | null {
  const target = targetGameweek(bootstrap.events, now);
  if (!target) {
    return null;
  }

  const lastGw = bootstrap.events.reduce((max, event) => Math.max(max, event.id), target.gw);
  const gws: number[] = [];
  for (let gw = target.gw; gw < target.gw + XP_PARAMS.horizonGws && gw <= lastGw; gw += 1) {
    gws.push(gw);
  }

  const teamShort = new Map(bootstrap.teams.map((team) => [team.id, team.short_name]));
  const matchesPlayed = new Map<number, number>();
  // gw -> team -> fixtures (two for a double gameweek, none for a blank one).
  const byWeek = new Map<number, Map<number, SideFixture[]>>(gws.map((gw) => [gw, new Map()]));

  for (const fixture of fixtures) {
    if (fixture.finished || fixture.finished_provisional) {
      matchesPlayed.set(fixture.team_h, (matchesPlayed.get(fixture.team_h) ?? 0) + 1);
      matchesPlayed.set(fixture.team_a, (matchesPlayed.get(fixture.team_a) ?? 0) + 1);
      continue;
    }
    const week = fixture.event === null ? undefined : byWeek.get(fixture.event);
    if (!week) {
      continue;
    }
    const sides: Array<[number, SideFixture]> = [
      [fixture.team_h, { opponentTeamId: fixture.team_a, home: true, difficulty: fixture.team_h_difficulty }],
      [fixture.team_a, { opponentTeamId: fixture.team_h, home: false, difficulty: fixture.team_a_difficulty }]
    ];
    for (const [teamId, side] of sides) {
      const list = week.get(teamId);
      if (list) list.push(side);
      else week.set(teamId, [side]);
    }
  }

  const players = new Map<number, XpPlayer>();
  for (const element of bootstrap.elements) {
    const base = XP_PARAMS.formWeight * element.form + XP_PARAMS.pointsPerGameWeight * element.points_per_game;
    const ratio = startRatio(element.starts, matchesPlayed.get(element.team) ?? 0);
    const chance = playChance(element);
    const gone = element.status === XP_PARAMS.goneStatus;

    const weeks = gws.map<XpGameweekXp>((gw, index) => {
      const availability = gone ? 0 : (index === 0 ? chance : 1) * ratio;
      const games = (byWeek.get(gw)?.get(element.team) ?? []).map<XpGameXp>((side) => ({
        opponentTeamId: side.opponentTeamId,
        opponent: teamShort.get(side.opponentTeamId) ?? "-",
        home: side.home,
        difficulty: side.difficulty,
        xp: availability * base * fixtureFactor(side.difficulty, side.home)
      }));
      return { gw, xp: games.reduce((sum, game) => sum + game.xp, 0), games };
    });

    const values = weeks.map((week) => week.xp);
    players.set(element.id, {
      id: element.id,
      teamId: element.team,
      elementType: element.element_type,
      status: element.status,
      selectedByPercent: element.selected_by_percent,
      base,
      startRatio: ratio,
      playChance: gone ? 0 : chance,
      availability: gone ? 0 : chance * ratio,
      weeks,
      next: values[0] ?? 0,
      sum3: discountedSum(values, XP_PARAMS.sumHorizons[0]),
      sum5: discountedSum(values, XP_PARAMS.sumHorizons[1])
    });
  }

  return {
    modelVersion: XP_MODEL_VERSION,
    targetGw: target.gw,
    targetDeadline: target.deadlineTime,
    gws,
    builtAt: now,
    players
  };
}
