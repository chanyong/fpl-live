import type { Locale } from "@/lib/locale";
import { formatMoney } from "@/lib/season-summary";
import type { SquadOutlookWeek, SquadPlayer } from "@/lib/squad-types";

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
  change: { ko: "가격 변동(시즌 시작가 대비)", en: "Price change (since season start)" }
};

export function metricLabel(metric: SquadMetric, locale: Locale) {
  return locale === "en" ? LABELS[metric].en : LABELS[metric].ko;
}

/** "+0.1", "-0.3", "0.0": a price move given in tenths of a million. */
export function formatPriceChange(tenths: number) {
  const value = (tenths / 10).toFixed(1);
  return tenths > 0 ? `+${value}` : value;
}

/** "+£0.3m", "−£0.2m", "£0.0m": the same move with the unit and a true minus sign, for cards (issue #74). */
export function formatPriceChangeMoney(tenths: number) {
  const value = (Math.abs(tenths) / 10).toFixed(1);
  if (tenths > 0) return `+£${value}m`;
  if (tenths < 0) return `−£${value}m`;
  return `£${value}m`;
}

/** The move as a share of the opening price ("+5.1%"), the secondary figure; null when the opening price is unknown. */
export function formatPriceChangePercent(player: Pick<SquadPlayer, "nowCost" | "costChangeStart">) {
  const start = player.nowCost - player.costChangeStart;
  if (start <= 0) return null;
  const pct = (player.costChangeStart / start) * 100;
  const value = Math.abs(pct).toFixed(1);
  if (player.costChangeStart > 0) return `+${value}%`;
  if (player.costChangeStart < 0) return `−${value}%`;
  return `${value}%`;
}

/** Rise green, fall red, no move neutral; a text colour class. */
export function priceChangeTone(tenths: number) {
  return tenths > 0 ? "text-emerald-700" : tenths < 0 ? "text-[var(--danger)]" : "";
}

export const FDR_HORIZON_KEY = "fpl-live-squad-fdr-horizon";
export type FdrHorizon = 3 | 5;

export function parseFdrHorizon(raw: string | null): FdrHorizon {
  return raw === "5" ? 5 : 3;
}

/**
 * The first `horizon` gameweeks of a player's outlook. Older cached payloads carry only the next gameweek's
 * fixtures: those become a single week (gw 0 = unknown), so the card still shows something.
 */
export function outlookWeeks(player: Pick<SquadPlayer, "fixtures" | "outlook">, horizon: FdrHorizon): SquadOutlookWeek[] {
  if (player.outlook && player.outlook.length > 0) {
    return player.outlook.slice(0, horizon);
  }
  return player.fixtures.length === 0 ? [] : [{ gw: 0, games: player.fixtures }];
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
