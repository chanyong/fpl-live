import type { PlayerStat } from "@/lib/types";

export type PriceOutlook = "very-likely" | "likely" | "unlikely";

/** The progress meter crosses ±100 when FPL moves a price; these cuts follow FPL's own wording. */
const VERY_LIKELY_CUT = 100;
const LIKELY_CUT = 95;

export function priceOutlook(projectedPercent: number): PriceOutlook {
  const size = Math.abs(projectedPercent);

  if (size >= VERY_LIKELY_CUT) {
    return "very-likely";
  }

  return size >= LIKELY_CUT ? "likely" : "unlikely";
}

/** Largest projected moves first, risers and fallers together. */
export function selectPricePredictions(players: PlayerStat[]) {
  return [...players].sort(
    (left, right) =>
      Math.abs(right.projectedPercent) - Math.abs(left.projectedPercent) ||
      left.webName.localeCompare(right.webName)
  );
}

/** Players whose price already moved since the last deadline, biggest move first. */
export function selectRecentPriceChanges(players: PlayerStat[]) {
  return players
    .filter((player) => player.costChangeEvent !== 0)
    .sort(
      (left, right) =>
        Math.abs(right.costChangeEvent) - Math.abs(left.costChangeEvent) ||
        right.costChangeEvent - left.costChangeEvent ||
        left.webName.localeCompare(right.webName)
    );
}
