/**
 * Pure helpers for the weekly review journal (issue #21).
 * No DB or network here: the caller feeds in FPL public API data and stores the result.
 */

export type SnapshotEvent = {
  id: number;
  finished: boolean;
  deadline_time?: string | null;
};

/**
 * Gameweeks that should have a saved snapshot but do not yet.
 * A gameweek is due once FPL marks it finished; every finished week without a
 * saved row is returned, so a missed run is backfilled by the next run.
 */
export function getDueSnapshotGws(events: SnapshotEvent[], savedGws: Iterable<number>) {
  const saved = new Set(savedGws);
  return events
    .filter((event) => event.finished && !saved.has(event.id))
    .map((event) => event.id)
    .sort((a, b) => a - b);
}

/**
 * Earliest moment the next unsaved gameweek can be saved: the deadline of the
 * gameweek after it (FPL finishes a week before the following deadline).
 * Used to propose a schedule; returns null when nothing is left to wait for.
 */
export function getNextSnapshotCheck(events: SnapshotEvent[], now: number) {
  const upcoming = events
    .filter((event) => event.deadline_time && Date.parse(event.deadline_time) > now)
    .sort((a, b) => Date.parse(a.deadline_time!) - Date.parse(b.deadline_time!))[0];
  return upcoming ? { gw: upcoming.id, at: upcoming.deadline_time! } : null;
}

type HistoryRow = {
  event: number;
  points: number;
  total_points: number;
  overall_rank: number | null;
  event_transfers: number;
  event_transfers_cost: number;
  points_on_bench: number;
};

type PickRow = { element: number; position: number; multiplier: number; isCaptain: boolean };

export type WeeklySnapshot = {
  gw: number;
  points: number;
  totalPoints: number;
  overallRank: number | null;
  transfers: number;
  transferCost: number;
  benchPoints: number;
  chip: string | null;
  captain: number | null;
  starters: number[];
  bench: number[];
  fixtures: Array<{ id: number; teamH: number; teamA: number; scoreH: number | null; scoreA: number | null }>;
};

/** Returns null when FPL has no row for this gameweek (not played or still empty). */
export function buildWeeklySnapshot(input: {
  gw: number;
  history: { current: HistoryRow[]; chips: Array<{ name: string; event: number }> };
  picks: PickRow[];
  fixtures: Array<{ id: number; event: number; teamH: number; teamA: number; scoreH: number | null; scoreA: number | null }>;
}): WeeklySnapshot | null {
  const row = input.history.current.find((item) => item.event === input.gw);
  if (!row) return null;

  const ordered = [...input.picks].sort((a, b) => a.position - b.position);
  return {
    gw: input.gw,
    points: row.points,
    totalPoints: row.total_points,
    overallRank: row.overall_rank,
    transfers: row.event_transfers,
    transferCost: row.event_transfers_cost,
    benchPoints: row.points_on_bench,
    chip: input.history.chips.find((chip) => chip.event === input.gw)?.name ?? null,
    captain: ordered.find((pick) => pick.isCaptain)?.element ?? null,
    starters: ordered.filter((pick) => pick.position <= 11).map((pick) => pick.element),
    bench: ordered.filter((pick) => pick.position > 11).map((pick) => pick.element),
    fixtures: input.fixtures.filter((fixture) => fixture.event === input.gw).map(({ event: _event, ...rest }) => rest)
  };
}
