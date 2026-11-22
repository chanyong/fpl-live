import { getBootstrapStatic, getFixtures } from "@/lib/fpl-client";
import { getCurrentGw } from "@/lib/gameweek";
import { buildProvisionalBonusByElement } from "@/lib/league-aggregator";
import { buildPlayerStat, buildTeamOutlook } from "@/lib/player-stats";
import { buildPremierLeagueTable } from "@/lib/pl-table";
import type { PlayerStat, PremierLeagueTableRow, TeamFixtureOutlook, TeamOutlookData } from "@/lib/types";

/**
 * Premier League facts that belong to no mini-league: the table, the fixture list, the team fixture
 * difficulty and the player pool. Built from FPL's bootstrap and fixtures only, so the public pages
 * (/premier-league, /fixtures, /players, issue #33 stage 2) can render them on the server.
 */
type Bootstrap = Awaited<ReturnType<typeof getBootstrapStatic>>;
type Fixtures = Awaited<ReturnType<typeof getFixtures>>;

/** Gameweeks listed on the fixtures page: the current one and the two after it. */
const FIXTURE_WEEKS = 3;

export type PublicFixtureSide = { name: string; shortName: string; code: number; score: number | null };

export type PublicFixture = {
  id: number;
  gw: number;
  kickoffTime: string | null;
  home: PublicFixtureSide;
  away: PublicFixtureSide;
  state: "upcoming" | "live" | "finished";
  minutes: number;
};

export type PublicFixtureWeek = { gw: number; fixtures: PublicFixture[] };

export type PublicFootball = {
  currentGw: number;
  table: PremierLeagueTableRow[];
  weeks: PublicFixtureWeek[];
  /** Feeds components/team-fixture-table. */
  teamOutlook: TeamOutlookData;
};

export type PublicPlayers = {
  currentGw: number;
  nextGw: number | null;
  players: PlayerStat[];
  fdr: Record<string, TeamFixtureOutlook[]>;
};

/**
 * The gameweek to treat as current. Before the season opens FPL has no current or finished gameweek and
 * the shared rule would land on the last one, so fall back to the first.
 */
export function publicCurrentGw(events: Bootstrap["events"]) {
  const started = events.some((event) => event.is_current || event.finished);
  return started ? getCurrentGw(events) : (events[0]?.id ?? 1);
}

function fixtureState(fixture: Fixtures[number]): PublicFixture["state"] {
  if (fixture.finished || fixture.finished_provisional) {
    return "finished";
  }
  return fixture.started ? "live" : "upcoming";
}

function byKickoff(left: PublicFixture, right: PublicFixture) {
  // A fixture with no date yet goes last.
  if (left.kickoffTime === null || right.kickoffTime === null) {
    return (left.kickoffTime === null ? 1 : 0) - (right.kickoffTime === null ? 1 : 0) || left.id - right.id;
  }
  return left.kickoffTime.localeCompare(right.kickoffTime) || left.id - right.id;
}

export function buildPublicFootball(bootstrap: Bootstrap, fixtures: Fixtures): PublicFootball {
  const currentGw = publicCurrentGw(bootstrap.events);
  const teamsById = new Map(bootstrap.teams.map((team) => [team.id, team]));
  const side = (teamId: number, score: number | null): PublicFixtureSide => {
    const team = teamsById.get(teamId);
    return { name: team?.name ?? "-", shortName: team?.short_name ?? "-", code: team?.code ?? 0, score };
  };

  const weeks: PublicFixtureWeek[] = [];
  for (let gw = currentGw; gw < currentGw + FIXTURE_WEEKS; gw += 1) {
    const inWeek = fixtures
      .filter((fixture) => fixture.event === gw)
      .map<PublicFixture>((fixture) => {
        const state = fixtureState(fixture);
        // A score before kickoff is not a result.
        const scored = state !== "upcoming";
        return {
          id: fixture.id,
          gw,
          kickoffTime: fixture.kickoff_time,
          home: side(fixture.team_h, scored ? fixture.team_h_score : null),
          away: side(fixture.team_a, scored ? fixture.team_a_score : null),
          state,
          minutes: state === "live" ? fixture.minutes : 0
        };
      })
      .sort(byKickoff);

    if (inWeek.length > 0) {
      weeks.push({ gw, fixtures: inWeek });
    }
  }

  const { outlook } = buildTeamOutlook(bootstrap.teams, fixtures, currentGw);

  return {
    currentGw,
    table: buildPremierLeagueTable(bootstrap.teams, fixtures),
    weeks,
    teamOutlook: {
      league: { currentGw },
      players: bootstrap.teams.map((team) => ({ teamShortName: team.short_name, teamCode: team.code })),
      outlook
    }
  };
}

export function buildPublicPlayers(bootstrap: Bootstrap, fixtures: Fixtures): PublicPlayers {
  const currentGw = publicCurrentGw(bootstrap.events);
  const nextEvent = bootstrap.events.find((event) => event.is_next);
  const nextGw = nextEvent?.id ?? (currentGw < 38 ? currentGw + 1 : null);
  const teamsById = new Map(bootstrap.teams.map((team) => [team.id, team]));

  // Bonus is only confirmed at the final whistle; show the same provisional gameweek score the league tabs do.
  const provisionalBonus = buildProvisionalBonusByElement(fixtures.filter((fixture) => fixture.event === currentGw));

  const players = bootstrap.elements
    .filter((element) => element.minutes > 0)
    .map((element) =>
      buildPlayerStat(element, teamsById, element.event_points + (provisionalBonus.get(element.id) ?? 0))
    )
    .sort((left, right) => right.totalPoints - left.totalPoints || left.webName.localeCompare(right.webName));

  return { currentGw, nextGw, players, fdr: buildTeamOutlook(bootstrap.teams, fixtures, currentGw).fdr };
}
