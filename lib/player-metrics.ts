import type { FplPosition, PlayerStat, TeamFixtureOutlook } from "@/lib/types";
import type { Locale } from "@/lib/locale";

/** Below this many minutes a form figure is noise, not a signal. */
export const DIFFERENTIAL_MIN_MINUTES = 45;

export type DifferentialCuts = {
  /** Owned by this share of the world, or less. */
  ownershipCut: number;
  /** …while scoring at least this. */
  formCut: number;
};

/**
 * Lightly-owned players in form — the quadrant the scatter highlights.
 * The list and the chart share this filter so they can never show different players.
 */
export function selectDifferentials(players: PlayerStat[], cuts: DifferentialCuts) {
  return players
    .filter(
      (player) =>
        player.minutes >= DIFFERENTIAL_MIN_MINUTES &&
        player.selectedByPercent <= cuts.ownershipCut &&
        player.form >= cuts.formCut
    )
    .sort((left, right) => right.form - left.form || right.totalPoints - left.totalPoints);
}

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

const AVAILABILITY: Record<string, { label: string; labelEn: string; tone: "ok" | "warn" | "out" }> = {
  a: { label: "출전 가능", labelEn: "Available", tone: "ok" },
  d: { label: "출전 의심", labelEn: "Doubtful", tone: "warn" },
  i: { label: "부상", labelEn: "Injured", tone: "out" },
  s: { label: "출전 정지", labelEn: "Suspended", tone: "out" },
  u: { label: "출전 불가", labelEn: "Unavailable", tone: "out" },
  n: { label: "스쿼드 제외", labelEn: "Not in squad", tone: "out" }
};

export function availability(status: string, locale: Locale = "ko") {
  const entry = AVAILABILITY[status] ?? AVAILABILITY.a;

  return { label: locale === "en" ? entry.labelEn : entry.label, tone: entry.tone };
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

/**
 * Mean fixture difficulty over the run shown in the strip.
 * Null when a team has no scheduled fixtures left, so it can sort to the end
 * rather than pretending to be the easiest run on the board.
 */
export function averageDifficulty(fixtures: TeamFixtureOutlook[]) {
  if (fixtures.length === 0) {
    return null;
  }

  return roundTo(fixtures.reduce((total, fixture) => total + fixture.difficulty, 0) / fixtures.length);
}

/** How FPL names each scoring line, in the order it lists them. */
const POINT_LABELS: Record<string, string> = {
  minutes: "출전 시간",
  starts: "선발 출전",
  goals_scored: "득점",
  assists: "도움",
  clean_sheets: "클린시트",
  goals_conceded: "실점",
  own_goals: "자책골",
  penalties_saved: "페널티 선방",
  penalties_missed: "페널티 실축",
  yellow_cards: "경고",
  red_cards: "퇴장",
  saves: "선방",
  defensive_contribution: "수비 기여",
  bonus: "보너스",
  bps: "BPS"
};

const POINT_LABELS_EN: Record<string, string> = {
  minutes: "Minutes played",
  starts: "Started",
  goals_scored: "Goals scored",
  assists: "Assists",
  clean_sheets: "Clean sheet",
  goals_conceded: "Goals conceded",
  own_goals: "Own goals",
  penalties_saved: "Penalties saved",
  penalties_missed: "Penalties missed",
  yellow_cards: "Yellow cards",
  red_cards: "Red cards",
  saves: "Saves",
  defensive_contribution: "Defensive contribution",
  bonus: "Bonus",
  bps: "BPS"
};

export function pointsLabel(identifier: string, locale: Locale = "ko") {
  const labels = locale === "en" ? POINT_LABELS_EN : POINT_LABELS;

  return labels[identifier] ?? identifier.replace(/_/g, " ");
}

/** How the recorded figure reads next to its label: "90분", "1골", "3점". */
export function pointsValueLabel(identifier: string, value: number, locale: Locale = "ko") {
  const en = locale === "en";

  switch (identifier) {
    case "minutes":
      return en ? `${value} min` : `${value}분`;
    case "goals_scored":
      return en ? `${value} ${value === 1 ? "goal" : "goals"}` : `${value}골`;
    case "assists":
      return en ? `${value} ${value === 1 ? "assist" : "assists"}` : `${value}도움`;
    case "saves":
      return en ? `${value} ${value === 1 ? "save" : "saves"}` : `${value}선방`;
    case "starts":
    case "clean_sheets":
      return value > 0 ? (en ? "Yes" : "예") : en ? "No" : "아니오";
    default:
      return String(value);
  }
}
