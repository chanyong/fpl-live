import type { FplPosition } from "@/lib/types";

export const POSITION_BY_TYPE: Record<number, FplPosition> = {
  1: "GKP",
  2: "DEF",
  3: "MID",
  4: "FWD"
};

export const POSITION_LABELS: Record<FplPosition, string> = {
  GKP: "GK",
  DEF: "DF",
  MID: "MF",
  FWD: "FW"
};

export function percent(part: number, whole: number) {
  return whole <= 0 ? 0 : (part / whole) * 100;
}

/**
 * Effective ownership: only starters score, and a captain scores twice.
 * This is what a player is actually worth to the league, not how many squads list him.
 */
export function effectiveOwnership(args: {
  starters: number;
  captains: number;
  managerCount: number;
}) {
  return percent(args.starters + args.captains, args.managerCount);
}

/**
 * Points an owner gains on the league average.
 *
 * A player every squad fields moves nobody up the table; a player nobody else has
 * is worth his whole score. Above 100% effective ownership the value goes negative —
 * merely owning him was not enough, you needed the armband too.
 */
export function differentialSwing(points: number, ownershipPercent: number) {
  return points * (1 - ownershipPercent / 100);
}

const AVAILABILITY: Record<string, { label: string; tone: "ok" | "warn" | "out" }> = {
  a: { label: "출전 가능", tone: "ok" },
  d: { label: "출전 의심", tone: "warn" },
  i: { label: "부상", tone: "out" },
  s: { label: "출전 정지", tone: "out" },
  u: { label: "출전 불가", tone: "out" },
  n: { label: "스쿼드 제외", tone: "out" }
};

export function availability(status: string) {
  return AVAILABILITY[status] ?? AVAILABILITY.a;
}

/** Highest-first ranking that drops zero/negative values rather than padding the list. */
export function topBy<T>(rows: T[], value: (row: T) => number, limit: number) {
  return [...rows]
    .filter((row) => value(row) > 0)
    .sort((left, right) => value(right) - value(left))
    .slice(0, limit);
}

export function roundTo(value: number, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
