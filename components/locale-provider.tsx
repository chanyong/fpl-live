"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { DEFAULT_LOCALE, LOCALE_STORAGE_KEY, pick, type Locale } from "@/lib/locale";

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  /** Korean is the source text; pass its English counterpart alongside it. */
  tr: <T = string>(ko: T, en: T) => T;
};

const LocaleContext = createContext<LocaleContextValue>({
  locale: DEFAULT_LOCALE,
  setLocale: () => undefined,
  tr: (ko) => ko
});

export function LocaleProvider({ children }: { children: ReactNode }) {
  // Always start Korean so the server and first client render agree, then adopt the saved choice.
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(LOCALE_STORAGE_KEY);
      if (saved === "ko" || saved === "en") {
        setLocaleState(saved);
      }
    } catch {
      // Storage can be blocked; the toggle then simply lasts for this visit.
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      // See above.
    }
  }, []);

  const value = useMemo<LocaleContextValue>(
    () => ({ locale, setLocale, tr: (ko, en) => pick(locale, ko, en) }),
    [locale, setLocale]
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  return useContext(LocaleContext);
}

export function LocaleToggle({ className }: { className?: string }) {
  const { locale, setLocale } = useLocale();

  return (
    <div
      role="group"
      aria-label="Language / 언어"
      className={`inline-flex shrink-0 rounded-full border border-[var(--border)] bg-white p-0.5 text-caption font-semibold ${className ?? ""}`}
    >
      {(
        [
          { id: "ko", label: "한국어" },
          { id: "en", label: "English" }
        ] as const
      ).map((item) => (
        <button
          key={item.id}
          type="button"
          aria-pressed={locale === item.id}
          onClick={() => setLocale(item.id)}
          className={`rounded-full px-3 py-1 transition ${
            locale === item.id ? "bg-[var(--info-soft)] text-[var(--info)] shadow-[inset_0_0_0_1px_var(--info)]" : "text-[var(--muted)] hover:text-[var(--text)]"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
