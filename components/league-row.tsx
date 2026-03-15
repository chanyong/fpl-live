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
      <td className="px-3 py-3.5 text-center">{row.rank}</td>
      <td className="px-3 py-3.5 font-semibold">{row.teamName}</td>
      <td className="px-3 py-3.5">{row.managerName}</td>
      <td className="px-3 py-3.5">{row.captainName}</td>
      <td className="px-3 py-3.5">{chipLabel(row.chip)}</td>
      <td className="px-3 py-3.5 text-right tabular-nums">{row.playersPlayed}</td>
      <td className="px-3 py-3.5 text-right tabular-nums">{row.gwPoints}</td>
      <td className="px-3 py-3.5 text-right tabular-nums">{row.totalPoints}</td>
    </>
  );
}

export function LeagueRowExpanded({ row }: { row: LeagueRowType }) {
  return (
    <SquadStrip
      squad={row.squad}
      lineupPoints={row.lineupPoints}
      transferCost={row.transferCost}
      gwPoints={row.gwPoints}
    />
  );
}
