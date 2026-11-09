/**
 * Pure helpers for the weekly review journal (issue #21).
 * No DB or network here: the caller feeds in FPL public API data and stores the result.
 */

export type SnapshotEvent = {
  id: number;
  finished: boolean;
  deadline_time?: string | null;
  /** FPL's gameweek average and highest score; absent on older callers. */
  average_entry_score?: number | null;
  highest_score?: number | null;
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
  /** The manager's rank for this gameweek alone (overall_rank is the running total). */
  rank?: number | null;
};

type PickRow = { element: number; position: number; multiplier: number; isCaptain: boolean; isVice?: boolean };

export type SnapshotStat = { id: string; value: number; points: number };

/** One squad member with the points ledger of that gameweek, frozen at save time (issue #27). */
export type SnapshotPlayer = {
  id: number;
  name: string;
  /** Short club name, e.g. "ARS". */
  team: string;
  /** FPL element_type: 1 GK, 2 DEF, 3 MID, 4 FWD. */
  type: number;
  /** Squad slot 1-15: 1-11 start, 12-15 bench in substitution order. */
  slot: number;
  multiplier: number;
  isCaptain: boolean;
  isVice: boolean;
  /** FPL total_points for the week, before the captain multiplier. */
  points: number;
  minutes: number;
  fixtures: Array<{ fixture: number; stats: SnapshotStat[] }>;
};

/** Everything build needs from bootstrap-static and event/{gw}/live, already reduced to plain data. */
export type SnapshotDetail = {
  players: Array<{ id: number; name: string; team: number; type: number }>;
  teams: Array<{ id: number; short: string }>;
  live: Array<{ id: number; points: number; minutes: number; explain: Array<{ fixture: number; stats: SnapshotStat[] }> }>;
  autoSubs: Array<{ in: number; out: number }>;
  average: number | null;
  highest: number | null;
};

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
  fixtures: Array<SnapshotFixture>;
  /**
   * Added in issue #27. Snapshots saved before that have none of these, so every reader
   * must treat them as optional.
   */
  viceCaptain?: number | null;
  autoSubs?: Array<{ in: number; out: number }>;
  gwRank?: number | null;
  average?: number | null;
  highest?: number | null;
  /** Club id -> short name, for the fixtures above. */
  teams?: Record<string, string>;
  players?: SnapshotPlayer[];
};

export type SnapshotFixture = {
  id: number;
  teamH: number;
  teamA: number;
  scoreH: number | null;
  scoreA: number | null;
  kickoff?: string | null;
  finished?: boolean;
};

/** Returns null when FPL has no row for this gameweek (not played or still empty). */
export function buildWeeklySnapshot(input: {
  gw: number;
  history: { current: HistoryRow[]; chips: Array<{ name: string; event: number }> };
  picks: PickRow[];
  fixtures: Array<SnapshotFixture & { event: number }>;
  detail?: SnapshotDetail;
}): WeeklySnapshot | null {
  const row = input.history.current.find((item) => item.event === input.gw);
  if (!row) return null;

  const ordered = [...input.picks].sort((a, b) => a.position - b.position);
  const base: WeeklySnapshot = {
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
  if (!input.detail) return base;

  const { detail } = input;
  const catalog = new Map(detail.players.map((player) => [player.id, player]));
  const clubs = new Map(detail.teams.map((team) => [team.id, team.short]));
  const live = new Map(detail.live.map((entry) => [entry.id, entry]));
  const players: SnapshotPlayer[] = ordered.map((pick) => {
    const known = catalog.get(pick.element);
    const ledger = live.get(pick.element);
    return {
      id: pick.element,
      name: known?.name ?? `#${pick.element}`,
      team: (known && clubs.get(known.team)) ?? "-",
      type: known?.type ?? 3,
      slot: pick.position,
      multiplier: pick.multiplier,
      isCaptain: pick.isCaptain,
      isVice: Boolean(pick.isVice),
      points: ledger?.points ?? 0,
      minutes: ledger?.minutes ?? 0,
      fixtures: ledger?.explain ?? []
    };
  });
  const teamIds = new Set(base.fixtures.flatMap((fixture) => [fixture.teamH, fixture.teamA]));
  const teams: Record<string, string> = {};
  for (const id of teamIds) teams[String(id)] = clubs.get(id) ?? `#${id}`;

  return {
    ...base,
    viceCaptain: ordered.find((pick) => pick.isVice)?.element ?? null,
    autoSubs: detail.autoSubs,
    gwRank: row.rank ?? null,
    average: detail.average,
    highest: detail.highest,
    teams,
    players
  };
}

/** Keys the issue #27 backfill may add to an old snapshot. Nothing else is ever touched. */
export const DETAIL_KEYS = ["players", "teams", "autoSubs", "viceCaptain", "gwRank", "average", "highest"] as const;

/**
 * Adds the #27 detail to an OLD snapshot without changing any value it already has:
 * only missing DETAIL_KEYS are appended, and fixtures (matched by id) only gain kickoff/finished when absent.
 * Points, ranks, squad, chip and scores stay exactly as saved, so removing the new keys restores the original.
 */
export function mergeDetailIntoSnapshot(old: Record<string, unknown>, fresh: WeeklySnapshot): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...old };
  for (const key of DETAIL_KEYS) {
    if (!(key in merged) && fresh[key] !== undefined) merged[key] = fresh[key];
  }
  if (Array.isArray(old.fixtures)) {
    const latest = new Map(fresh.fixtures.map((fixture) => [fixture.id, fixture]));
    merged.fixtures = old.fixtures.map((fixture) => {
      const known = typeof fixture === "object" && fixture !== null ? (fixture as Record<string, unknown>) : null;
      const match = known ? latest.get(known.id as number) : undefined;
      if (!known || !match) return fixture;
      const extra: Record<string, unknown> = {};
      if (!("kickoff" in known) && match.kickoff !== undefined) extra.kickoff = match.kickoff;
      if (!("finished" in known) && match.finished !== undefined) extra.finished = match.finished;
      return { ...known, ...extra };
    });
  }
  return merged;
}

/** True when this saved snapshot already carries the issue #27 detail. */
export function hasSnapshotDetail(snapshot: unknown) {
  return typeof snapshot === "object" && snapshot !== null && Array.isArray((snapshot as { players?: unknown }).players);
}

/** Effective points of a squad member as FPL shows them: captain multiplier applied, bench raw. */
export function playerDisplayPoints(player: Pick<SnapshotPlayer, "points" | "multiplier" | "slot">) {
  return player.slot <= 11 && player.multiplier > 1 ? player.points * player.multiplier : player.points;
}

/** Fixtures grouped by UK match date (UTC date of kickoff), earliest first; unknown dates last. */
export function groupFixturesByDay<T extends { kickoff?: string | null }>(fixtures: T[]) {
  const groups = new Map<string, T[]>();
  for (const fixture of [...fixtures].sort((a, b) => (a.kickoff ?? "9").localeCompare(b.kickoff ?? "9"))) {
    const key = fixture.kickoff ? fixture.kickoff.slice(0, 10) : "";
    groups.set(key, [...(groups.get(key) ?? []), fixture]);
  }
  return [...groups.entries()].map(([day, items]) => ({ day, items }));
}
