type GameweekEvent = {
  id: number;
  is_current: boolean;
  finished: boolean;
};

/**
 * Resolves the gameweek the dashboard should render.
 *
 * FPL keeps `is_current` on a gameweek until the next one opens, so a finished
 * gameweek still counts as current. Every aggregator must share this rule or
 * the league table and the rank-trend tab end up on different gameweeks.
 */
export function getCurrentGw(events: GameweekEvent[]) {
  const current = events.find((event) => event.is_current);

  if (current) {
    return current.id;
  }

  const lastFinished = [...events].reverse().find((event) => event.finished);
  return lastFinished?.id ?? events[events.length - 1]?.id ?? 1;
}

type DeadlineEvent = {
  id: number;
  is_next?: boolean;
  deadline_time?: string | null;
};

/**
 * The next transfer deadline still ahead of `now`.
 *
 * FPL flags the upcoming gameweek with `is_next`; if that flag is missing or stale the first
 * deadline in the future is used instead, so the banner never counts down to a past date.
 */
export function getNextDeadline(events: DeadlineEvent[], now: number) {
  const upcoming = events
    .filter((event) => event.deadline_time && new Date(event.deadline_time).getTime() > now)
    .sort((a, b) => new Date(a.deadline_time!).getTime() - new Date(b.deadline_time!).getTime());
  const flagged = upcoming.find((event) => event.is_next);
  const chosen = flagged ?? upcoming[0];

  return chosen ? { gw: chosen.id, deadlineTime: chosen.deadline_time! } : null;
}
