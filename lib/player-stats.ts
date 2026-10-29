import { recordPredictionSnapshot } from "@/lib/price-prediction-log";
import { getBootstrapStatic, getFixtures, getPriceChangeHistory } from "@/lib/fpl-client";
import { buildPremierLeagueTable } from "@/lib/pl-table";
import { buildProvisionalBonusByElement, getLeagueLivePayload } from "@/lib/league-aggregator";
import {
  POSITION_BY_TYPE,
  differentialSwing,
  effectiveOwnership,
  percent,
  roundTo
} from "@/lib/player-metrics";
import type {
  LeaguePlayerStat,
  PlayerStat,
  PlayerStatsResponse,
  PriceChangeEvent,
  PriceChangesResponse,
  TeamFixtureOutlook
} from "@/lib/types";

type PlayerStatsArgs = {
  leagueId: number;
  gw: string;
  forceRefresh?: boolean;
};

const CACHE_TTL_MS = 30_000;
const CACHE_MAX_ENTRIES = 20;
/** How many upcoming fixtures the difficulty strip shows. */
const FDR_WINDOW = 5;
/** Gameweeks the team fixture table spans after the current one. */
const OUTLOOK_GAMEWEEKS = 7;

const playerStatsCache = new Map<string, { data: PlayerStatsResponse; expiresAt: number }>();

function prunePlayerStatsCache() {
  const now = Date.now();

  for (const [key, entry] of playerStatsCache) {
    if (entry.expiresAt <= now) {
      playerStatsCache.delete(key);
    }
  }

  while (playerStatsCache.size >= CACHE_MAX_ENTRIES) {
    const oldest = playerStatsCache.keys().next();
    if (oldest.done) {
      break;
    }
    playerStatsCache.delete(oldest.value);
  }
}

function photoUrl(photo: string) {
  return photo
    ? `https://resources.premierleague.com/premierleague/photos/players/110x140/p${photo.replace(".jpg", "")}.png`
    : null;
}

type BootstrapElement = Awaited<ReturnType<typeof getBootstrapStatic>>["elements"][number];
type BootstrapTeam = Awaited<ReturnType<typeof getBootstrapStatic>>["teams"][number];

function buildPlayerStat(
  element: BootstrapElement,
  teamsById: Map<number, BootstrapTeam>,
  eventPoints: number
): PlayerStat {
  const team = teamsById.get(element.team);
  const nextProjection = element.price_change_projections.find((projection) => projection.offset === 0);

  return {
    id: element.id,
    webName: element.web_name,
    teamId: element.team,
    teamShortName: team?.short_name ?? "-",
    teamCode: team?.code ?? 0,
    position: POSITION_BY_TYPE[element.element_type] ?? "MID",
    cost: element.now_cost,
    costChangeEvent: element.cost_change_event,
    priceChangePercent: roundTo(element.price_change_percent),
    projectedPercent: roundTo(nextProjection?.projected_percent ?? element.price_change_percent),
    priceLockedUntil: element.price_change_locked_until,
    priceLikelihood: nextProjection?.likelihood ?? 0,
    priceCalibrating: element.price_change_calibrating,
    totalPoints: element.total_points,
    eventPoints,
    form: element.form,
    pointsPerGame: element.points_per_game,
    selectedByPercent: element.selected_by_percent,
    transfersInEvent: element.transfers_in_event,
    transfersOutEvent: element.transfers_out_event,
    netTransfers: element.transfers_in_event - element.transfers_out_event,
    minutes: element.minutes,
    ictIndex: element.ict_index,
    expectedGoalInvolvements: element.expected_goal_involvements,
    status: element.status,
    news: element.news,
    photoUrl: photoUrl(element.photo)
  };
}

export async function getPlayerStatsPayload({
  leagueId,
  gw,
  forceRefresh
}: PlayerStatsArgs): Promise<PlayerStatsResponse> {
  const cacheKey = `${leagueId}:${gw}`;

  if (!forceRefresh) {
    const cached = playerStatsCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }
  }

  // The league payload is memoised by the standings tab, so this usually costs nothing extra.
  const [bootstrap, fixtures, live] = await Promise.all([
    getBootstrapStatic(),
    getFixtures(),
    getLeagueLivePayload({ leagueId, gw, forceRefresh })
  ]);

  const currentGw = live.league.currentGw;
  const nextEvent = bootstrap.events.find((event) => event.is_next);
  const nextGw = nextEvent?.id ?? (currentGw < 38 ? currentGw + 1 : null);

  const teamsById = new Map(bootstrap.teams.map((team) => [team.id, team]));
  const elementsById = new Map(bootstrap.elements.map((element) => [element.id, element]));

  // Bonus is only confirmed at the final whistle; mirror what the league table shows
  // so a player's gameweek score never disagrees between tabs.
  const provisionalBonus = buildProvisionalBonusByElement(
    fixtures.filter((fixture) => fixture.event === currentGw)
  );

  // Managers keep a stable index so ownership can be sent as a compact list of positions.
  const managers = [...live.rows]
    .sort((left, right) => left.rank - right.rank)
    .map((row) => ({
      entryId: row.entryId,
      managerName: row.managerName,
      teamName: row.teamName,
      rank: row.rank
    }));
  const managerCount = managers.length;
  const indexByEntry = new Map(managers.map((manager, index) => [manager.entryId, index]));

  type Ownership = { owners: number[]; captains: number[]; starters: number };
  const ownership = new Map<number, Ownership>();

  for (const row of live.rows) {
    const index = indexByEntry.get(row.entryId);
    if (index === undefined) {
      continue;
    }

    const starterIds = new Set(row.squad.starters.map((card) => card.elementId));

    for (const card of [...row.squad.starters, ...row.squad.bench]) {
      const entry = ownership.get(card.elementId) ?? { owners: [], captains: [], starters: 0 };
      entry.owners.push(index);
      if (card.isCaptain) {
        entry.captains.push(index);
      }
      if (starterIds.has(card.elementId)) {
        entry.starters += 1;
      }
      ownership.set(card.elementId, entry);
    }
  }

  const gwPointsOf = (element: { id: number; event_points: number }) =>
    element.event_points + (provisionalBonus.get(element.id) ?? 0);

  const toPlayerStat = (element: BootstrapElement) =>
    buildPlayerStat(element, teamsById, gwPointsOf(element));

  // Anyone who has kicked a ball, plus everyone a league squad holds even if he has not.
  const players = bootstrap.elements
    .filter((element) => element.minutes > 0 || ownership.has(element.id))
    .map(toPlayerStat);

  const leaguePlayers: LeaguePlayerStat[] = [...ownership.entries()]
    .map(([elementId, entry]) => {
      const element = elementsById.get(elementId);
      const team = element ? teamsById.get(element.team) : undefined;
      const gwPoints = element ? gwPointsOf(element) : 0;
      const seasonPoints = element?.total_points ?? 0;
      const leaguePercent = percent(entry.owners.length, managerCount);
      const eo = effectiveOwnership({
        starters: entry.starters,
        captains: entry.captains.length,
        managerCount
      });

      return {
        elementId,
        webName: element?.web_name ?? `Player ${elementId}`,
        teamShortName: team?.short_name ?? "-",
        teamCode: team?.code ?? 0,
        position: POSITION_BY_TYPE[element?.element_type ?? 3] ?? "MID",
        cost: element?.now_cost ?? 0,
        ownedBy: entry.owners.length,
        owners: entry.owners,
        captains: entry.captains,
        starters: entry.starters,
        leaguePercent: roundTo(leaguePercent),
        effectiveOwnership: roundTo(eo),
        globalPercent: element?.selected_by_percent ?? 0,
        gwPoints,
        seasonPoints,
        leagueContribution: seasonPoints * entry.owners.length,
        // Nobody realises a gain from a player every owner left on the bench.
        gwSwing: entry.starters > 0 ? roundTo(differentialSwing(gwPoints, eo)) : 0,
        // Lineups are not kept per gameweek, so the season figure uses today's roster share.
        seasonSwing: roundTo(differentialSwing(seasonPoints, leaguePercent))
      };
    })
    .sort((left, right) => right.ownedBy - left.ownedBy || right.seasonPoints - left.seasonPoints);

  const fdr: Record<string, TeamFixtureOutlook[]> = {};
  const outlook: Record<string, TeamFixtureOutlook[]> = {};
  const upcoming = fixtures
    .filter((fixture) => fixture.event !== null && fixture.event > currentGw)
    .sort((left, right) => (left.event ?? 0) - (right.event ?? 0));

  for (const team of bootstrap.teams) {
    const fixturesOfTeam = upcoming
      .filter((fixture) => fixture.team_h === team.id || fixture.team_a === team.id)
      .map((fixture) => {
        const home = fixture.team_h === team.id;
        const opponentId = home ? fixture.team_a : fixture.team_h;

        return {
          gw: fixture.event ?? 0,
          opponent: teamsById.get(opponentId)?.short_name ?? "-",
          home,
          difficulty: home ? fixture.team_h_difficulty : fixture.team_a_difficulty
        };
      });

    fdr[team.short_name] = fixturesOfTeam.slice(0, FDR_WINDOW);
    outlook[team.short_name] = fixturesOfTeam.filter((fixture) => fixture.gw <= currentGw + OUTLOOK_GAMEWEEKS);
  }

  const result: PlayerStatsResponse = {
    league: {
      id: live.league.id,
      name: live.league.name,
      currentGw,
      nextGw,
      managerCount,
      lastUpdated: new Date().toISOString()
    },
    managers,
    players,
    fdr,
    outlook,
    table: buildPremierLeagueTable(bootstrap.teams, fixtures),
    leaguePlayers
  };

  prunePlayerStatsCache();
  playerStatsCache.set(cacheKey, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });

  return result;
}

const PRICE_CACHE_TTL_MS = 60_000;
let priceCache: { data: PriceChangesResponse; expiresAt: number } | null = null;

/**
 * Everything the price page shows, independent of any league — so it works for visitors who
 * have not entered a league ID. Mirrors fantasy.premierleague.com/price-changes: predictions
 * cover every player FPL has not marked unavailable ("u"), and the history comes from FPL's own
 * dated log rather than this gameweek's cost_change_event.
 */
export async function getPriceChangeData(): Promise<PriceChangesResponse> {
  if (priceCache && priceCache.expiresAt > Date.now()) {
    return priceCache.data;
  }

  const [bootstrap, log] = await Promise.all([getBootstrapStatic(), getPriceChangeHistory()]);
  const teamsById = new Map(bootstrap.teams.map((team) => [team.id, team]));
  const elementsById = new Map(bootstrap.elements.map((element) => [element.id, element]));
  const players = bootstrap.elements
    .filter((element) => element.status !== "u")
    .map((element) => buildPlayerStat(element, teamsById, element.event_points));
  const history: PriceChangeEvent[] = log.flatMap((change) => {
    const element = elementsById.get(change.element);

    if (!element) {
      return [];
    }

    return [
      {
        playerId: change.element,
        webName: element.web_name,
        teamShortName: teamsById.get(change.team)?.short_name ?? "-",
        position: POSITION_BY_TYPE[element.element_type] ?? "MID",
        changedAt: change.changed_at,
        costBefore: change.cost_before,
        costAfter: change.cost_after
      }
    ];
  });
  const nextUpdate =
    bootstrap.game_config.settings.price_change_deadlines.find((time) => new Date(time).getTime() > Date.now()) ??
    null;

  const data = { players, history, nextUpdate };
  priceCache = { data, expiresAt: Date.now() + PRICE_CACHE_TTL_MS };
  // No-op unless PRICE_PREDICTION_LOG_DIR is set; uses the data above, no extra FPL calls.
  void recordPredictionSnapshot(data);
  return data;
}
