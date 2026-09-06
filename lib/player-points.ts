import { getBootstrapStatic, getEventLive, getFixtures } from "@/lib/fpl-client";
import { buildProvisionalBonusByElement } from "@/lib/league-aggregator";
import { getCurrentGw } from "@/lib/gameweek";
import { POSITION_BY_TYPE, pointsLabel } from "@/lib/player-metrics";
import type { PlayerPointsFixture, PlayerPointsResponse, PointsLine } from "@/lib/types";

type PlayerPointsArgs = {
  elementId: number;
  gw: string;
};

const CACHE_TTL_MS = 30_000;
const CACHE_MAX_ENTRIES = 8;

type LiveByGw = Awaited<ReturnType<typeof getEventLive>>;

/**
 * The live payload is ~450KB and every open of the breakdown needs the same one, so it is
 * memoised by gameweek rather than fetched per player.
 */
const liveCache = new Map<number, { data: LiveByGw; expiresAt: number }>();

async function getLive(gw: number) {
  const cached = liveCache.get(gw);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const data = await getEventLive(gw);

  for (const [key, entry] of liveCache) {
    if (entry.expiresAt <= Date.now()) {
      liveCache.delete(key);
    }
  }
  while (liveCache.size >= CACHE_MAX_ENTRIES) {
    const oldest = liveCache.keys().next();
    if (oldest.done) {
      break;
    }
    liveCache.delete(oldest.value);
  }

  liveCache.set(gw, { data, expiresAt: Date.now() + CACHE_TTL_MS });
  return data;
}

/**
 * One player's gameweek score, line by line.
 *
 * FPL's own `explain` block is the ledger behind `total_points`, so reading it — rather than
 * re-deriving the scoring rules — guarantees the breakdown adds up to the figure on the card.
 * The only thing added on top is the provisional bonus the dashboard already shows, and it is
 * reported separately so it is obvious which part is not yet final.
 */
export async function getPlayerPointsPayload({
  elementId,
  gw
}: PlayerPointsArgs): Promise<PlayerPointsResponse> {
  const [bootstrap, fixtures] = await Promise.all([getBootstrapStatic(), getFixtures()]);

  const currentGw = gw === "current" ? getCurrentGw(bootstrap.events) : Number(gw);
  const live = await getLive(currentGw);

  const element = bootstrap.elements.find((row) => row.id === elementId);
  if (!element) {
    throw new Error(`Unknown player: ${elementId}`);
  }

  const teamsById = new Map(bootstrap.teams.map((team) => [team.id, team]));
  const gwFixtures = fixtures.filter((fixture) => fixture.event === currentGw);
  const fixturesById = new Map(gwFixtures.map((fixture) => [fixture.id, fixture]));
  const provisionalBonus = buildProvisionalBonusByElement(gwFixtures).get(elementId) ?? 0;

  const liveRow = live.elements.find((row) => row.id === elementId);
  const confirmedPoints = liveRow?.stats.total_points ?? 0;

  // Bonus is settled per fixture, so a lone unsettled fixture carries the whole estimate.
  const unsettled = liveRow
    ? liveRow.explain.filter((entry) => {
        const fixture = fixturesById.get(entry.fixture);
        return Boolean(fixture?.started) && !fixture?.finished_provisional;
      })
    : [];

  const playerFixtures: PlayerPointsFixture[] = (liveRow?.explain ?? []).map((entry) => {
    const fixture = fixturesById.get(entry.fixture);
    const home = fixture?.team_h === element.team;
    const opponentId = home ? fixture?.team_a : fixture?.team_h;
    const lines: PointsLine[] = entry.stats.map((stat) => ({
      identifier: stat.identifier,
      label: pointsLabel(stat.identifier),
      value: stat.value,
      points: stat.points + stat.points_modification
    }));
    const minutes = entry.stats.find((stat) => stat.identifier === "minutes")?.value ?? 0;
    const confirmed = lines.reduce((total, line) => total + line.points, 0);
    const share = unsettled.length > 0 && unsettled.some((row) => row.fixture === entry.fixture)
      ? Math.round(provisionalBonus / unsettled.length)
      : 0;

    return {
      fixtureId: entry.fixture,
      opponent: teamsById.get(opponentId ?? 0)?.short_name ?? "-",
      home,
      kickoffTime: fixture?.kickoff_time ?? null,
      started: Boolean(fixture?.started),
      settled: Boolean(fixture?.finished_provisional),
      minutes,
      lines,
      provisionalBonus: share,
      points: confirmed + share
    };
  });

  return {
    elementId,
    gw: currentGw,
    webName: element.web_name,
    teamShortName: teamsById.get(element.team)?.short_name ?? "-",
    position: POSITION_BY_TYPE[element.element_type] ?? "MID",
    confirmedPoints,
    provisionalBonus,
    points: confirmedPoints + provisionalBonus,
    fixtures: playerFixtures
  };
}
