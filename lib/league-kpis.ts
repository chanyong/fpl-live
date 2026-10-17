import type { LeagueRow } from "@/lib/types";

export type LeagueKpis = {
  topGw: { points: number; teamName: string } | null;
  averageGw: number;
  /** Total-points lead of first place over second; null with fewer than two managers. */
  leaderGap: number | null;
  chipCount: number;
  managerCount: number;
};

export function computeLeagueKpis(rows: LeagueRow[]): LeagueKpis {
  if (rows.length === 0) {
    return { topGw: null, averageGw: 0, leaderGap: null, chipCount: 0, managerCount: 0 };
  }

  const best = rows.reduce((top, row) => (row.gwPoints > top.gwPoints ? row : top), rows[0]);
  const totals = rows.map((row) => row.totalPoints).sort((a, b) => b - a);
  const average = rows.reduce((sum, row) => sum + row.gwPoints, 0) / rows.length;

  return {
    topGw: { points: best.gwPoints, teamName: best.teamName },
    averageGw: Math.round(average * 10) / 10,
    leaderGap: totals.length > 1 ? totals[0] - totals[1] : null,
    chipCount: rows.filter((row) => row.chip).length,
    managerCount: rows.length
  };
}
