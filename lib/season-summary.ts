import { CHIP_LABELS, chipSortIndex } from "@/lib/chips";
import type { ChipDefinition, ChipStatus, EntryHistoryPayload, ManagerSeason } from "@/lib/types";

/**
 * Season-long figures FPL already ships with each manager's history.
 *
 * The dashboard fetches `entry/{id}/history/` per manager for the rank trend and
 * used to parse three fields out of it. Everything here comes from the rest of
 * that same response — no additional request.
 */
export function buildManagerSeason(
  history: EntryHistoryPayload,
  chipDefinitions: ChipDefinition[],
  currentGw: number
): ManagerSeason {
  const rows = history.current ?? [];
  const latest = rows[rows.length - 1] ?? null;

  // Each definition is one usable chip; a played chip consumes the window it falls in.
  const unmatched = [...(history.chips ?? [])];
  const chips: ChipStatus[] = [...chipDefinitions]
    .sort((left, right) => left.start - right.start || chipSortIndex(left.name) - chipSortIndex(right.name))
    .map((definition) => {
      const index = unmatched.findIndex(
        (chip) =>
          chip.name === definition.name &&
          chip.event >= definition.start &&
          chip.event <= definition.stop
      );
      const played = index >= 0 ? unmatched.splice(index, 1)[0] : null;

      return {
        ...definition,
        label: CHIP_LABELS[definition.name] ?? definition.name,
        usedEvent: played?.event ?? null,
        expired: !played && definition.stop < currentGw
      };
    });

  const sum = (pick: (row: EntryHistoryPayload["current"][number]) => number) =>
    rows.reduce((total, row) => total + pick(row), 0);

  return {
    chips,
    chipsRemaining: chips.filter((chip) => chip.usedEvent === null && !chip.expired).length,
    pointsOnBench: sum((row) => row.points_on_bench),
    transfers: sum((row) => row.event_transfers),
    transferCost: sum((row) => row.event_transfers_cost),
    squadValue: latest ? latest.value : null,
    bank: latest ? latest.bank : null,
    overallRank: latest ? latest.overall_rank : null,
    pastSeasons: (history.past ?? []).map((season) => ({
      seasonName: season.season_name,
      totalPoints: season.total_points,
      rank: season.rank
    }))
  };
}

/** FPL reports money in tenths of a million. */
export function formatMoney(tenths: number | null) {
  if (tenths === null) {
    return "-";
  }

  return "£" + (tenths / 10).toFixed(1) + "m";
}
