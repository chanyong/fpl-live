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
