import type { ReactNode } from "react";
import { RankDelta } from "@/components/rank-delta";
import { chipLabel } from "@/lib/chips";
import type { LeagueRow as LeagueRowType } from "@/lib/types";
import { SquadStrip } from "@/components/squad-strip";

/** "22 -4" — the hit is invisible otherwise, since gwPoints is already net. */
export function GwPoints({ row, className }: { row: LeagueRowType; className?: string }) {
  return (
    <span className={`tabular-nums ${className ?? ""}`}>
      {row.gwPoints}
      {row.transferCost > 0 ? (
        <span
          className="ml-1 text-[11px] font-semibold text-rose-700"
          title={`라인업 ${row.lineupPoints}점, 이적 차감 -${row.transferCost}점`}
        >
          &minus;{row.transferCost}
        </span>
      ) : null}
    </span>
  );
}

export function LeagueRow({
  row,
  gwClassName,
  selectMark
}: {
  row: LeagueRowType;
  gwClassName?: string;
  selectMark?: ReactNode;
}) {
  return (
    <>
      <td className="px-2.5 py-1.5 text-center">
        <span className="inline-flex items-center gap-1.5">
          {selectMark}
          <span className="font-semibold tabular-nums text-stone-800">{row.projectedRank}</span>
        </span>
      </td>
      <td className="px-2.5 py-1.5 text-center text-[13px]">
        <RankDelta from={row.rank} to={row.projectedRank} />
      </td>
      <td className="px-2.5 py-1.5 font-semibold">{row.teamName}</td>
      <td className="px-2.5 py-1.5">{row.managerName}</td>
      <td className="px-2.5 py-1.5">{row.captainName}</td>
      <td className="px-2.5 py-1.5">{chipLabel(row.chip)}</td>
      <td className="px-2.5 py-1.5 text-right tabular-nums">{row.playersPlayed}</td>
      <td className={`px-2.5 py-1.5 text-right font-semibold ${gwClassName ?? "text-stone-800"}`}>
        <GwPoints row={row} />
      </td>
      <td className="px-2.5 py-1.5 text-right tabular-nums">{row.totalPoints}</td>
    </>
  );
}

export function LeagueRowExpanded({ row, gw }: { row: LeagueRowType; gw: number }) {
  return <SquadStrip squad={row.squad} gw={gw} />;
}
