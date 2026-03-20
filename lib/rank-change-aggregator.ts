import { getAllStandings, getBootstrapStatic, getEntryHistory, getEntryPicks } from "@/lib/fpl-client";
import type { Chip, EntryHistoryPayload, RankChangeManager, RankChangePoint, RankChangeResponse } from "@/lib/types";

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
  picks: {
    active_chip: Chip;
    entry_history: {
      event: number;
      points: number;
      total_points: number;
    };
  } | null;
};

function getCurrentGw(events: Array<{ id: number; is_current: boolean; finished: boolean }>) {
  const current = events.find((event) => event.is_current);

  if (current && !current.finished) {
    return current.id;
  }

  const next = events.find((event) => !event.finished);
  if (next) {
    return next.id;
  }

  return current?.id ?? events[events.length - 1]?.id ?? 1;
}

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

    if (manager.picks?.entry_history?.event === currentEventId) {
      byGw[currentEventId] = {
        event: currentEventId,
        total_points: manager.picks.entry_history.total_points,
        points: manager.picks.entry_history.points
      };
    }

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

export async function getLeagueRankChangePayload(args: {
  leagueId: number;
  forceRefresh?: boolean;
}): Promise<RankChangeResponse> {
  const [bootstrap, standings] = await Promise.all([
    getBootstrapStatic({ forceRefresh: args.forceRefresh }),
    getAllStandings(args.leagueId, { forceRefresh: args.forceRefresh })
  ]);

  const currentGw = getCurrentGw(bootstrap.events);

  const [historyPayloads, picksPayloads] = await Promise.all([
    Promise.all(
      standings.results.map((row) => getEntryHistory(row.entry, { forceRefresh: args.forceRefresh }))
    ),
    Promise.all(
      standings.results.map((row) => getEntryPicks(row.entry, currentGw, { forceRefresh: args.forceRefresh }).catch(() => null))
    )
  ]);

  const managersBase: ManagerBase[] = standings.results.map((row, index) => ({
    entry: row.entry,
    playerName: row.player_name || "Unknown Manager",
    entryName: row.entry_name || "Unnamed Team",
    overallRank: row.rank || null,
    overallTotal: row.total || 0,
    history: historyPayloads[index] || { current: [] },
    picks: picksPayloads[index]
      ? {
          active_chip: picksPayloads[index].active_chip,
          entry_history: picksPayloads[index].entry_history
        }
      : null
  }));

  const trendData = buildTrendData(bootstrap.events, managersBase, currentGw);

  const managers: RankChangeManager[] = managersBase
    .map((manager, index) => {
      const trend = trendData.timelines[manager.entry] || [];
      const filtered = trend.filter((row): row is RankChangePoint => Boolean(row));
      const latest = filtered.slice(-1)[0] || null;
      const previous = filtered.slice(-2, -1)[0] || null;

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
        trend
      };
    })
    .sort((a, b) => (a.latestRank ?? 999) - (b.latestRank ?? 999));

  return {
    league: {
      id: standings.league.id,
      name: standings.league.name,
      currentGw,
      lastUpdated: new Date().toISOString()
    },
    trend: {
      gameweeks: trendData.gameweeks
    },
    managers
  };
}
