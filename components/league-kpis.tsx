import { useMemo } from "react";
import { computeLeagueKpis } from "@/lib/league-kpis";
import type { LeagueRow } from "@/lib/types";

function KpiCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="min-w-[8.5rem] shrink-0 snap-start rounded-2xl border border-[var(--border)] bg-white/80 px-3 py-2.5 md:min-w-0 md:px-4 md:py-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)] md:text-xs">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold leading-none tabular-nums md:text-3xl">{value}</div>
      <div className="mt-1.5 truncate text-[11px] text-[var(--muted)] md:text-xs">{sub}</div>
    </div>
  );
}

/** Phones swipe the cards sideways; desktop lays them out as one four-column row. */
export function LeagueKpis({ rows, gw }: { rows: LeagueRow[]; gw: number }) {
  const kpis = useMemo(() => computeLeagueKpis(rows), [rows]);

  if (kpis.managerCount === 0) {
    return null;
  }

  return (
    <section
      aria-label={`게임위크 ${gw} 요약`}
      className="mb-3 flex snap-x gap-2 overflow-x-auto pb-1 md:grid md:grid-cols-4 md:gap-3 md:overflow-visible md:pb-0"
    >
      <KpiCard
        label="GW 최고 득점"
        value={kpis.topGw ? `${kpis.topGw.points}점` : "-"}
        sub={kpis.topGw?.teamName ?? ""}
      />
      <KpiCard label="GW 평균" value={`${kpis.averageGw}점`} sub={`${kpis.managerCount}명 기준`} />
      <KpiCard
        label="1위 격차"
        value={kpis.leaderGap === null ? "-" : `${kpis.leaderGap}점`}
        sub="2위와의 총점 차이"
      />
      <KpiCard label="칩 사용" value={`${kpis.chipCount}명`} sub={`GW ${gw}`} />
    </section>
  );
}
