import { getBootstrapStatic, getFixtures } from "@/lib/fpl-client";
import { getCurrentGw } from "@/lib/gameweek";
import { buildFixturesPayload, buildProvisionalBonusByElement } from "@/lib/league-aggregator";
import { buildPlayerStat, buildTeamOutlook } from "@/lib/player-stats";
import { buildPremierLeagueTable } from "@/lib/pl-table";
import type { LeagueFixture, PlayerStat, PremierLeagueTableRow, TeamFixtureOutlook, TeamOutlookData } from "@/lib/types";

/**
 * Premier League facts that belong to no mini-league: the table, the fixture list, the team fixture
 * difficulty and the player pool. Built from FPL's bootstrap and fixtures only, so the public pages
 * (/premier-league, /fixtures, /players, issue #33 stage 2) can render them on the server.
 */
type Bootstrap = Awaited<ReturnType<typeof getBootstrapStatic>>;
type Fixtures = Awaited<ReturnType<typeof getFixtures>>;

export type PublicFootball = {
  currentGw: number;
  /** The gameweek whose fixtures are listed: the requested one, else the current one. */
  gw: number;
  /** First and last gameweek that exist, for the previous/next buttons. */
  firstGw: number;
  lastGw: number;
  table: PremierLeagueTableRow[];
  /** Same shape as the league screen's fixtures, so the same card list draws them (issue #80). */
  fixtures: LeagueFixture[];
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

/** A gameweek number from the address (?gw=12); anything that is not a whole 1-38 means "the current one". */
export function parsePublicGw(raw: string | string[] | undefined): number | null {
  const text = Array.isArray(raw) ? raw[0] : raw;
  if (!text || !/^\d{1,2}$/.test(text)) {
    return null;
  }
  const gw = Number(text);
  return gw >= 1 && gw <= 38 ? gw : null;
}

export function buildPublicFootball(bootstrap: Bootstrap, fixtures: Fixtures, requestedGw?: number | null): PublicFootball {
  const currentGw = publicCurrentGw(bootstrap.events);
  const ids = bootstrap.events.map((event) => event.id);
  const firstGw = ids.length > 0 ? Math.min(...ids) : 1;
  const lastGw = ids.length > 0 ? Math.max(...ids) : 38;
  const gw = requestedGw && requestedGw >= firstGw && requestedGw <= lastGw ? requestedGw : currentGw;

  const teams = bootstrap.teams.map((team) => ({ id: team.id, name: team.name, shortName: team.short_name, code: team.code }));
  const elements = bootstrap.elements.map((element) => ({
    id: element.id,
    webName: element.web_name,
    teamId: element.team,
    elementType: element.element_type,
    photo: element.photo
  }));
  // A score before kickoff is a placeholder, not a result.
  const leagueFixtures = buildFixturesPayload(
    fixtures.filter((fixture) => fixture.event === gw),
    new Map(teams.map((team) => [team.id, team])),
    new Map(elements.map((element) => [element.id, element]))
  ).map((fixture) =>
    fixture.started || fixture.finished || fixture.finishedProvisional ? fixture : { ...fixture, homeScore: null, awayScore: null }
  );

  const { outlook } = buildTeamOutlook(bootstrap.teams, fixtures, currentGw);

  return {
    currentGw,
    gw,
    firstGw,
    lastGw,
    table: buildPremierLeagueTable(bootstrap.teams, fixtures),
    fixtures: leagueFixtures,
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
