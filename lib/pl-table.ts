import type { PremierLeagueTableRow } from "@/lib/types";

type TableTeam = { id: number; name: string; short_name: string; code: number };

type TableFixture = {
  kickoff_time: string | null;
  team_h: number;
  team_a: number;
  team_h_score: number | null;
  team_a_score: number | null;
  started: boolean | null;
};

const FORM_LENGTH = 5;

/**
 * The Premier League table, built from the season's fixtures.
 *
 * FPL has no standings endpoint, so every started fixture with a score counts, a match in
 * play included, which keeps the table moving with the live scores on the rest of the page.
 * Ties break on goal difference, then goals scored, then name; the league's head-to-head rules
 * are not modelled.
 */
export function buildPremierLeagueTable(teams: TableTeam[], fixtures: TableFixture[]): PremierLeagueTableRow[] {
  const teamsById = new Map(teams.map((team) => [team.id, team]));
  const rows = new Map(
    teams.map((team) => [
      team.id,
      {
        team: team.name,
        shortName: team.short_name,
        teamCode: team.code,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0,
        points: 0,
        form: [] as Array<"W" | "D" | "L">,
        next: null as PremierLeagueTableRow["next"]
      }
    ])
  );

  const byKickoff = (left: TableFixture, right: TableFixture) =>
    (left.kickoff_time ?? "").localeCompare(right.kickoff_time ?? "");

  const played = fixtures
    .filter((fixture) => fixture.started && fixture.team_h_score !== null && fixture.team_a_score !== null)
    .sort(byKickoff);

  for (const fixture of played) {
    const home = rows.get(fixture.team_h);
    const away = rows.get(fixture.team_a);
    if (!home || !away) {
      continue;
    }

    const homeGoals = fixture.team_h_score as number;
    const awayGoals = fixture.team_a_score as number;

    for (const [row, scored, conceded] of [
      [home, homeGoals, awayGoals],
      [away, awayGoals, homeGoals]
    ] as const) {
      const result = scored > conceded ? "W" : scored === conceded ? "D" : "L";
      row.played += 1;
      row.goalsFor += scored;
      row.goalsAgainst += conceded;
      row.goalDifference = row.goalsFor - row.goalsAgainst;
      row.points += result === "W" ? 3 : result === "D" ? 1 : 0;
      if (result === "W") row.won += 1;
      else if (result === "D") row.drawn += 1;
      else row.lost += 1;
      row.form.push(result);
    }
  }

  const upcoming = fixtures
    .filter((fixture) => !fixture.started && fixture.kickoff_time)
    .sort(byKickoff);

  for (const fixture of upcoming) {
    for (const [teamId, opponentId, isHome] of [
      [fixture.team_h, fixture.team_a, true],
      [fixture.team_a, fixture.team_h, false]
    ] as const) {
      const row = rows.get(teamId);
      const opponent = teamsById.get(opponentId);
      if (row && opponent && row.next === null) {
        row.next = { opponent: opponent.short_name, opponentCode: opponent.code, home: isHome };
      }
    }
  }

  return [...rows.values()]
    .map((row) => ({ ...row, form: row.form.slice(-FORM_LENGTH) }))
    .sort(
      (left, right) =>
        right.points - left.points ||
        right.goalDifference - left.goalDifference ||
        right.goalsFor - left.goalsFor ||
        left.team.localeCompare(right.team)
    )
    .map((row, index) => ({ position: index + 1, ...row }));
}
