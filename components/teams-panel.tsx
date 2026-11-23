"use client";

import { PremierLeagueTable } from "@/components/premier-league-table";
import { TeamFixtureTable } from "@/components/team-fixture-table";
import type { PremierLeagueTableRow, TeamOutlookData } from "@/lib/types";

/**
 * The upcoming-fixture-difficulty grid above the Premier League table. The league screen's 팀 tab and the
 * top-menu /premier-league page both draw this (issue #80), so the two cannot show different things or
 * a different order.
 */
export function TeamsPanel({ outlook, table }: { outlook: TeamOutlookData; table: PremierLeagueTableRow[] }) {
  return (
    <>
      <TeamFixtureTable data={outlook} />
      <PremierLeagueTable table={table} />
    </>
  );
}
