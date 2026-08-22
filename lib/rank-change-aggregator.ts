import { mapWithConcurrency } from "@/lib/concurrency";
import { getBootstrapStatic, getEntryHistory } from "@/lib/fpl-client";
import { getLeagueLivePayload } from "@/lib/league-aggregator";
import type {
  EntryHistoryPayload,
  RankChangeManager,
  RankChangePoint,
  RankChangeResponse
} from "@/lib/types";

const ENTRY_CONCURRENCY = Number(process.env.FPL_PICKS_CONCURRENCY ?? 8);

/** Window used for the "recent form" movement figure. */
const RECENT_WINDOW = 5;

const CHART_COLORS = [
  "#cf8952", "#67b39f", "#72b9ea", "#d3829f", "#e4ad55", "#8b7fe6", "#84c76b", "#e98e64",
  "#6db8c7", "#c59652", "#ea7d7d", "#8c9cdf", "#57a88e", "#bb6ba2", "#7f9b47", "#c3a15c",
  "#599dc2", "#d49f73", "#95b86f", "#a080d8"
];

type ManagerBase = {
  entry: number;
  playerName: string;
  entryName: string;
  overallRank: number | null;
  overallTotal: number;
  history: EntryHistoryPayload;
  /** Live figures for the current gameweek, straight from the league table payload. */
  live: { gwPoints: number; totalPoints: number };
};

function getTrackedGameweeks(
  events: Array<{ id: number; finished: boolean; is_current: boolean }>,
  histories: EntryHistoryPayload[]
) {
  const finishedEvents = events
    .filter((event) => event.finished || event.is_current)
    .map((event) => event.id);

  const historyEvents = new Set<number>();
  histories.forEach((history) => {
    (history.current || []).forEach((row) => {
      if (row.event) {
        historyEvents.add(row.event);
      }
    });
  });

  return Array.from(new Set([...finishedEvents, ...historyEvents])).sort((a, b) => a - b);
}

function buildTrendData(
  events: Array<{ id: number; finished: boolean; is_current: boolean }>,
  managers: ManagerBase[],
  currentEventId: number
) {
  const gameweeks = getTrackedGameweeks(events, managers.map((manager) => manager.history));
  const timelines: Record<number, Array<RankChangePoint | null>> = {};

  managers.forEach((manager) => {
    const byGw: Record<number, { event: number; total_points: number; points: number }> = {};
    (manager.history.current || []).forEach((row) => {
      byGw[row.event] = row;
    });

    // The current gameweek always comes from the live table so both tabs agree.
    byGw[currentEventId] = {
      event: currentEventId,
      total_points: manager.live.totalPoints,
      points: manager.live.gwPoints
    };

    timelines[manager.entry] = gameweeks.map((gw) => {
      const row = byGw[gw];
      return row
        ? {
            gw,
            totalPoints: row.total_points,
            eventPoints: row.points,
            rank: 0
          }
        : null;
    });
  });

  gameweeks.forEach((_gw, index) => {
    const rows = managers
      .map((manager) => {
        const row = timelines[manager.entry][index];
        return row ? { entry: manager.entry, totalPoints: row.totalPoints } : null;
      })
      .filter((row): row is { entry: number; totalPoints: number } => Boolean(row))
      .sort((a, b) => b.totalPoints - a.totalPoints);

    let rank = 1;
    rows.forEach((row, rowIndex) => {
      if (rowIndex > 0 && row.totalPoints < rows[rowIndex - 1].totalPoints) {
        rank = rowIndex + 1;
      }
      const timelineRow = timelines[row.entry][index];
      if (timelineRow) {
        timelineRow.rank = rank;
      }
    });
  });

  return { gameweeks, timelines };
}

/** Positive means the manager climbed; null when there is nothing to compare against. */
function rankMovement(points: RankChangePoint[], window?: number) {
  const slice = window ? points.slice(-window) : points;
  if (slice.length < 2) {
    return null;
  }

  return slice[0].rank - slice[slice.length - 1].rank;
}

export async function getLeagueRankChangePayload(args: {
  leagueId: number;
}): Promise<RankChangeResponse> {
  // The live payload is the shared source of truth for the current gameweek; it is
  // memoised per league, so the standings tab usually pays for this fetch already.
  const [bootstrap, live] = await Promise.all([
    getBootstrapStatic(),
    getLeagueLivePayload({ leagueId: args.leagueId, gw: "current" })
  ]);

  const currentGw = live.league.currentGw;

  const historyResults = await mapWithConcurrency(live.rows, ENTRY_CONCURRENCY, (row) =>
    getEntryHistory(row.entryId)
  );

  const managersBase: ManagerBase[] = live.rows.map((row, index) => {
    const result = historyResults[index];

    return {
      entry: row.entryId,
      playerName: row.managerName || "Unknown Manager",
      entryName: row.teamName || "Unnamed Team",
      overallRank: row.rank || null,
      overallTotal: row.totalPoints || 0,
      history: result.status === "fulfilled" ? result.value : { current: [] },
      live: { gwPoints: row.gwPoints, totalPoints: row.totalPoints }
    };
  });

  const trendData = buildTrendData(bootstrap.events, managersBase, currentGw);

  const managers: RankChangeManager[] = managersBase
    .map((manager, index) => {
      const trend = trendData.timelines[manager.entry] || [];
      const filtered = trend.filter((row): row is RankChangePoint => Boolean(row));
      const latest = filtered[filtered.length - 1] ?? null;
      const previous = filtered[filtered.length - 2] ?? null;

      return {
        entry: manager.entry,
        playerName: manager.playerName,
        entryName: manager.entryName,
        overallRank: manager.overallRank,
        totalPoints: latest?.totalPoints ?? manager.overallTotal,
        latestRank: latest?.rank ?? manager.overallRank,
        gwPoints: latest?.eventPoints ?? 0,
        color: CHART_COLORS[index % CHART_COLORS.length],
        previousRank: previous?.rank ?? null,
        seasonChange: rankMovement(filtered),
        recentChange: rankMovement(filtered, RECENT_WINDOW),
        trend
      };
    })
    .sort((a, b) => (a.latestRank ?? 999) - (b.latestRank ?? 999));

  return {
    league: {
      id: live.league.id,
      name: live.league.name,
      currentGw,
      lastUpdated: new Date().toISOString()
    },
    trend: {
      gameweeks: trendData.gameweeks
    },
    managers
  };
}
