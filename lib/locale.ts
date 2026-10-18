export type Locale = "ko" | "en";

export const DEFAULT_LOCALE: Locale = "ko";
export const LOCALE_STORAGE_KEY = "fpl-live-locale";

/** Intl tag for each locale, so dates and numbers follow the language on screen. */
export const INTL_TAG: Record<Locale, string> = { ko: "ko-KR", en: "en-GB" };

export function pick<T>(locale: Locale, ko: T, en: T): T {
  return locale === "en" ? en : ko;
}
