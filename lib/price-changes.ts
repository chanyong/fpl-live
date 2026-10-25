import type { PlayerStat, PriceChangeEvent } from "@/lib/types";

/**
 * The five statuses fantasy.premierleague.com/price-changes shows, strongest rise first.
 * FPL decides them itself through `price_change_projections[0].likelihood`; nothing here is
 * re-derived from the progress figures.
 */
export type PriceStatus = "very-likely-rise" | "likely-rise" | "no-change" | "likely-drop" | "very-likely-drop";

export const PRICE_STATUS_ORDER: PriceStatus[] = [
  "very-likely-rise",
  "likely-rise",
  "no-change",
  "likely-drop",
  "very-likely-drop"
];

export function priceStatus(likelihood: number): PriceStatus {
  switch (likelihood) {
    case 5:
      return "very-likely-rise";
    case 4:
      return "likely-rise";
    case -4:
      return "likely-drop";
    case -5:
      return "very-likely-drop";
    default:
      return "no-change";
  }
}

export type PriceDirection = "all" | "rise" | "drop" | "locked";

/** Same split as the official "Rise & drop" filter: by the sign of the current progress. */
export function matchesDirection(player: PlayerStat, direction: PriceDirection) {
  switch (direction) {
    case "locked":
      return player.priceLockedUntil !== null;
    case "rise":
      return player.priceChangePercent > 0;
    case "drop":
      return player.priceChangePercent < 0;
    default:
      return true;
  }
}

/** Whole days until a price lock lifts, rounded up as FPL does. */
export function daysUntilUnlock(lockedUntil: string, now = Date.now()) {
  return Math.max(0, Math.ceil((new Date(lockedUntil).getTime() - now) / 86_400_000));
}

/** Official default order: furthest from zero progress first, risers and fallers together. */
export function selectPricePredictions(players: PlayerStat[]) {
  return [...players].sort(
    (left, right) =>
      Math.abs(right.priceChangePercent) - Math.abs(left.priceChangePercent) ||
      left.webName.localeCompare(right.webName)
  );
}

/** Official default order: newest move first; moves applied together read alphabetically. */
export function selectRecentPriceChanges(history: PriceChangeEvent[]) {
  return [...history].sort(
    (left, right) =>
      new Date(right.changedAt).getTime() - new Date(left.changedAt).getTime() ||
      left.webName.localeCompare(right.webName)
  );
}

/** Up/down arrow FPL shows next to each player: this gameweek's transfers in against out. */
export function ownershipTrend(player: PlayerStat): "up" | "down" | null {
  if (player.transfersInEvent === player.transfersOutEvent) {
    return null;
  }

  return player.transfersInEvent > player.transfersOutEvent ? "up" : "down";
}
