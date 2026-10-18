import { useMemo } from "react";
import { KpiCard, KpiGrid } from "@/components/kpi-card";
import { computeLeagueKpis } from "@/lib/league-kpis";
import type { LeagueRow } from "@/lib/types";
import { useLocale } from "@/components/locale-provider";

export function LeagueKpis({ rows, gw }: { rows: LeagueRow[]; gw: number }) {
  const { tr } = useLocale();
  const kpis = useMemo(() => computeLeagueKpis(rows), [rows]);

  if (kpis.managerCount === 0) {
    return null;
  }

  return (
    <KpiGrid label={tr(`게임위크 ${gw} 요약`, `Gameweek ${gw} summary`)} columns={2}>
      <KpiCard
        label={tr("GW 최고 득점", "GW top score")}
        value={kpis.topGw ? `${kpis.topGw.points}${tr("점", " pts")}` : "-"}
        sub={kpis.topGw?.teamName ?? ""}
      />
      <KpiCard
        label={tr("GW 평균", "GW average")}
        value={`${kpis.averageGw}${tr("점", " pts")}`}
        sub={tr(`${kpis.managerCount}명 기준`, `${kpis.managerCount} managers`)}
      />
      <KpiCard
        label={tr("1위 격차", "Lead over 2nd")}
        value={kpis.leaderGap === null ? "-" : `${kpis.leaderGap}${tr("점", " pts")}`}
        sub={tr("2위와 총점 차", "Total points gap")}
      />
      <KpiCard label={tr("칩 사용", "Chips played")} value={`${kpis.chipCount}${tr("명", "")}`} sub={`GW ${gw}`} />
    </KpiGrid>
  );
}
