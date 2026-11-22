import type { Locale } from "@/lib/locale";
import { formatMoney } from "@/lib/season-summary";
import type { SquadPlayer } from "@/lib/squad-types";

/** What a player card shows under the name, in the order of the selector. */
export const SQUAD_METRICS = ["opponent", "points", "price", "selling", "fdr", "form", "ownership", "change"] as const;
export type SquadMetric = (typeof SQUAD_METRICS)[number];

const LABELS: Record<SquadMetric, { ko: string; en: string }> = {
  opponent: { ko: "상대", en: "Opponent" },
  points: { ko: "점수", en: "Points" },
  price: { ko: "현재가", en: "Current price" },
  selling: { ko: "판매가(추정)", en: "Selling price (est.)" },
  fdr: { ko: "FDR", en: "FDR" },
  form: { ko: "폼", en: "Form" },
  ownership: { ko: "소유율", en: "Ownership" },
  change: { ko: "가격 변동", en: "Price change" }
};

export function metricLabel(metric: SquadMetric, locale: Locale) {
  return locale === "en" ? LABELS[metric].en : LABELS[metric].ko;
}

/** "+0.1", "-0.3", "0.0": a price move given in tenths of a million. */
export function formatPriceChange(tenths: number) {
  const value = (tenths / 10).toFixed(1);
  return tenths > 0 ? `+${value}` : value;
}

export function formatOpponent(fixture: SquadPlayer["fixtures"][number]) {
  return `${fixture.opponent} (${fixture.home ? "H" : "A"})`;
}

/** Plain text of one metric, for the metrics that are a single value. Opponent and FDR are drawn by the card. */
export function metricText(player: SquadPlayer, metric: SquadMetric): string {
  switch (metric) {
    case "points":
      return player.eventPoints === null ? "-" : String(player.eventPoints);
    case "price":
      return formatMoney(player.nowCost);
    case "selling":
      return formatMoney(player.sellingPrice);
    case "form":
      return player.form.toFixed(1);
    case "ownership":
      return `${player.selectedByPercent.toFixed(1)}%`;
    case "change":
      return formatPriceChange(player.costChangeStart);
    case "opponent":
      return player.fixtures.length === 0 ? "-" : player.fixtures.map(formatOpponent).join(", ");
    case "fdr":
      return player.fixtures.length === 0 ? "-" : player.fixtures.map((fixture) => fixture.difficulty).join(", ");
  }
}

export const SQUAD_VIEW_KEY = "fpl-live-squad-view";
export type SquadViewMode = "pitch" | "list";

/** The saved view choice (pitch or list, which metric); anything unreadable falls back to the defaults. */
export function parseSquadView(raw: string | null): { mode: SquadViewMode; metric: SquadMetric } {
  const fallback = { mode: "pitch" as SquadViewMode, metric: "opponent" as SquadMetric };
  if (!raw) {
    return fallback;
  }
  try {
    const value = JSON.parse(raw) as { mode?: unknown; metric?: unknown };
    return {
      mode: value.mode === "list" ? "list" : "pitch",
      metric: SQUAD_METRICS.find((metric) => metric === value.metric) ?? "opponent"
    };
  } catch {
    return fallback;
  }
}
