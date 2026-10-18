import type { Locale } from "@/lib/locale";

/** English display names for the chips FPL exposes. */
export const CHIP_LABELS_EN: Record<string, string> = {
  wildcard: "Wildcard",
  freehit: "Free Hit",
  bboost: "Bench Boost",
  "3xc": "Triple Captain",
  manager: "Assistant Manager"
};

/** Display names for the chips FPL exposes. Unknown names fall through as-is. */
export const CHIP_LABELS: Record<string, string> = {
  wildcard: "와일드카드",
  freehit: "프리 힛",
  bboost: "벤치 부스트",
  "3xc": "트리플 캡틴",
  manager: "매니저"
};

export const CHIP_SHORT_LABELS: Record<string, string> = {
  wildcard: "WC",
  freehit: "FH",
  bboost: "BB",
  "3xc": "TC",
  manager: "MGR"
};

/** Order chips read in, rather than the order the API happens to list them. */
const CHIP_ORDER = ["wildcard", "freehit", "bboost", "3xc", "manager"];

export function chipSortIndex(name: string) {
  const index = CHIP_ORDER.indexOf(name);
  return index === -1 ? CHIP_ORDER.length : index;
}

export function chipLabel(name: string | null, short = false, locale: Locale = "ko") {
  if (!name) {
    return "-";
  }

  const long = locale === "en" ? CHIP_LABELS_EN : CHIP_LABELS;
  return (short ? CHIP_SHORT_LABELS[name] : long[name]) ?? name;
}
