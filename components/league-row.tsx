import { RankDelta } from "@/components/rank-delta";
import type { LeagueRow as LeagueRowType } from "@/lib/types";
import { SquadStrip } from "@/components/squad-strip";

export function chipLabel(chip: LeagueRowType["chip"], short = false) {
  if (!chip) {
    return "-";
  }

  const labels = {
    "3xc": short ? "TC" : "트리플 캡틴",
    bboost: short ? "BB" : "벤치 부스트",
    freehit: short ? "FH" : "프리 힛",
    wildcard: short ? "WC" : "와일드카드",
    manager: short ? "MGR" : "매니저"
  };

  return labels[chip] ?? chip;
}

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

export function LeagueRow({ row, gwClassName }: { row: LeagueRowType; gwClassName?: string }) {
  return (
    <>
      <td className="px-2.5 py-3 text-center">
        <span className="font-semibold tabular-nums text-stone-800">{row.projectedRank}</span>
      </td>
      <td className="px-2.5 py-3 text-center text-[13px]">
        <RankDelta from={row.rank} to={row.projectedRank} />
      </td>
      <td className="px-2.5 py-3 font-semibold">{row.teamName}</td>
      <td className="px-2.5 py-3">{row.managerName}</td>
      <td className="px-2.5 py-3">{row.captainName}</td>
      <td className="px-2.5 py-3">{chipLabel(row.chip)}</td>
      <td className="px-2.5 py-3 text-right tabular-nums">{row.playersPlayed}</td>
      <td className={`px-2.5 py-3 text-right font-semibold ${gwClassName ?? "text-stone-800"}`}>
        <GwPoints row={row} />
      </td>
      <td className="px-2.5 py-3 text-right tabular-nums">{row.totalPoints}</td>
    </>
  );
}

export function LeagueRowExpanded({ row }: { row: LeagueRowType }) {
  return <SquadStrip squad={row.squad} />;
}
