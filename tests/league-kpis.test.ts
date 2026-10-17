import { describe, expect, it } from "vitest";
import { computeLeagueKpis } from "@/lib/league-kpis";
import type { Chip, LeagueRow } from "@/lib/types";

function row(teamName: string, gwPoints: number, totalPoints: number, chip: Chip = null): LeagueRow {
  return { teamName, gwPoints, totalPoints, chip } as LeagueRow;
}

describe("computeLeagueKpis", () => {
  it("summarises top score, average, leader gap and chips", () => {
    const kpis = computeLeagueKpis([row("A", 6, 458), row("B", 9, 450, "3xc"), row("C", 4, 418)]);

    expect(kpis.topGw).toEqual({ points: 9, teamName: "B" });
    expect(kpis.averageGw).toBe(6.3);
    expect(kpis.leaderGap).toBe(8);
    expect(kpis.chipCount).toBe(1);
    expect(kpis.managerCount).toBe(3);
  });

  it("handles empty and single-manager leagues", () => {
    expect(computeLeagueKpis([]).topGw).toBeNull();
    expect(computeLeagueKpis([row("A", 5, 100)]).leaderGap).toBeNull();
  });
});
