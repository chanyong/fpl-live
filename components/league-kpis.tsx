import { useMemo } from "react";
import { KpiCard, KpiGrid } from "@/components/kpi-card";
import { computeLeagueKpis } from "@/lib/league-kpis";
import type { LeagueRow } from "@/lib/types";

export function LeagueKpis({ rows, gw }: { rows: LeagueRow[]; gw: number }) {
  const kpis = useMemo(() => computeLeagueKpis(rows), [rows]);

  if (kpis.managerCount === 0) {
    return null;
  }

  return (
    <KpiGrid label={`게임위크 ${gw} 요약`} columns={2}>
      <KpiCard
        label="GW 최고 득점"
        value={kpis.topGw ? `${kpis.topGw.points}점` : "-"}
        sub={kpis.topGw?.teamName ?? ""}
      />
      <KpiCard label="GW 평균" value={`${kpis.averageGw}점`} sub={`${kpis.managerCount}명 기준`} />
      <KpiCard
        label="1위 격차"
        value={kpis.leaderGap === null ? "-" : `${kpis.leaderGap}점`}
        sub="2위와 총점 차"
      />
      <KpiCard label="칩 사용" value={`${kpis.chipCount}명`} sub={`GW ${gw}`} />
    </KpiGrid>
  );
}
