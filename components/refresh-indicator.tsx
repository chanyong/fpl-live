"use client";

import { useEffect, useState } from "react";
import { RefreshIcon } from "@/components/icons";
import { relativeTimeLabel } from "@/lib/time-format";
import { useLocale } from "@/components/locale-provider";

type RefreshIndicatorProps = {
  lastUpdated: string | null;
  isFetching: boolean;
  isProvisional: boolean;
  onRefresh: () => void;
};

export function RefreshIndicator({
  lastUpdated,
  isFetching,
  isProvisional,
  onRefresh
}: RefreshIndicatorProps) {
  const { tr, locale } = useLocale();
  // Re-render on a timer so "3분 전" keeps counting between fetches.
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 10_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="flex flex-wrap items-center gap-2 text-caption text-[var(--muted)]">
      <span className="inline-flex items-center gap-1.5">
        <span
          className={`h-2 w-2 rounded-full ${isFetching ? "animate-pulse bg-[var(--accent)]" : "bg-emerald-500"}`}
          aria-hidden="true"
        />
        {isFetching
          ? tr("갱신 중", "Updating")
          : tr(`${relativeTimeLabel(lastUpdated, now, locale)} 기준`, `as of ${relativeTimeLabel(lastUpdated, now, locale)}`)}
      </span>

      {isProvisional ? (
        <span
          className="rounded-full bg-amber-100 px-2 py-0.5 text-caption font-medium text-amber-800"
          title={tr(
            "보너스 포인트와 자동 교체는 FPL이 게임위크를 확정한 뒤 바뀔 수 있습니다",
            "Bonus points and auto-subs may change once FPL finalises the gameweek"
          )}
        >
          {tr("잠정 집계", "Provisional")}
        </span>
      ) : null}

      <button
        type="button"
        onClick={onRefresh}
        disabled={isFetching}
        className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-[var(--border)] bg-white px-3 font-semibold text-[var(--text)] transition hover:border-[var(--accent)] disabled:opacity-50"
      >
        <RefreshIcon className={isFetching ? "animate-spin" : undefined} />
        {tr("새로고침", "Refresh")}
      </button>
    </div>
  );
}
