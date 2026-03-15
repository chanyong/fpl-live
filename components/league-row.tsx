import type { LeagueRow as LeagueRowType } from "@/lib/types";
import { SquadStrip } from "@/components/squad-strip";

function chipLabel(chip: LeagueRowType["chip"]) {
  if (!chip) {
    return "-";
  }

  return (
    {
      "3xc": "Triple Captain",
      bboost: "Bench Boost",
      freehit: "Free Hit",
      wildcard: "Wildcard",
      manager: "Manager"
    }[chip] ?? chip
  );
}

export function LeagueRow({ row }: { row: LeagueRowType }) {
  return (
    <>
      <td className="px-4 py-4 text-center">{row.rank}</td>
      <td className="px-4 py-4 font-semibold">{row.teamName}</td>
      <td className="px-4 py-4">{row.managerName}</td>
      <td className="px-4 py-4">{row.captainName}</td>
      <td className="px-4 py-4">{chipLabel(row.chip)}</td>
      <td className="px-4 py-4 text-right tabular-nums">{row.playersPlayed}</td>
      <td className="px-4 py-4 text-right tabular-nums">{row.gwPoints}</td>
      <td className="px-4 py-4 text-right tabular-nums">{row.totalPoints}</td>
      <td className="px-4 py-4 text-right tabular-nums">
        {row.projectedRank}
        {row.provisional ? (
          <span className="ml-2 rounded-full bg-amber-100 px-2 py-1 text-xs text-[var(--warning)]">
            provisional
          </span>
        ) : null}
      </td>
    </>
  );
}

export function LeagueRowExpanded({ row }: { row: LeagueRowType }) {
  return <SquadStrip squad={row.squad} />;
}
