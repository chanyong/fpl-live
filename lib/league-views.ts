/**
 * The league dashboard's screens and the address each one lives at (issue #33).
 *
 *   /league/ID                    경기 일정 (default, so old links keep working)
 *   /league/ID/standings/table    순위표
 *   /league/ID/standings/trend    순위 추이
 *   /league/ID/teams              팀
 *   /league/ID/players            선수
 */
export type LeagueView = "fixtures" | "table" | "rank-change" | "teams" | "players";
export type LeagueTab = "standings" | "team" | "player";
export type StandingsView = Extract<LeagueView, "fixtures" | "table" | "rank-change">;

const VIEW_SEGMENTS: Record<LeagueView, string[]> = {
  fixtures: [],
  table: ["standings", "table"],
  "rank-change": ["standings", "trend"],
  teams: ["teams"],
  players: ["players"]
};

/** The view for the path below /league/ID. Anything unknown falls back to the default view. */
export function viewFromSegments(segments: readonly string[]): LeagueView {
  const key = segments.join("/");
  const hit = (Object.keys(VIEW_SEGMENTS) as LeagueView[]).find((view) => VIEW_SEGMENTS[view].join("/") === key);
  return hit ?? "fixtures";
}

export function leagueViewPath(leagueId: string | number, view: LeagueView): string {
  return ["/league", String(leagueId), ...VIEW_SEGMENTS[view]].join("/");
}

export function tabOfView(view: LeagueView): LeagueTab {
  return view === "teams" ? "team" : view === "players" ? "player" : "standings";
}

export function isStandingsView(view: LeagueView): view is StandingsView {
  return tabOfView(view) === "standings";
}
