"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/components/locale-provider";

/** The deadline is always shown in Korea time, in the language on screen. */
const KST_FORMATTERS = {
  ko: new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }),
  en: new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Seoul",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  })
};

/** "2일 3시간 15분" — whole units left until the deadline, never rounded up. */
function remainingParts(deadline: number, now: number) {
  const minutes = Math.max(0, Math.floor((deadline - now) / 60_000));

  return { days: Math.floor(minutes / 1440), hours: Math.floor((minutes % 1440) / 60), minutes: minutes % 60 };
}

export function DeadlineBanner({ gw, deadlineTime }: { gw: number; deadlineTime: string }) {
  const { tr, locale } = useLocale();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  const deadline = new Date(deadlineTime).getTime();
  if (!Number.isFinite(deadline)) {
    return null;
  }

  const left = remainingParts(deadline, now);
  const passed = deadline <= now;
  // Under a day left is when a transfer is still easy to forget, so the banner turns amber.
  const urgent = !passed && deadline - now < 24 * 60 * 60 * 1000;

  return (
    <section
      aria-label={tr(`게임위크 ${gw} 마감`, `Gameweek ${gw} deadline`)}
      className={`mb-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-0.5 rounded-xl border-2 px-3 py-2 shadow-sm md:flex-nowrap md:gap-x-3 md:py-1.5 ${
        urgent
          ? "border-amber-500 bg-amber-50"
          : "border-[var(--accent)] bg-[var(--accent-soft)]/60"
      }`}
    >
      <div className="min-w-0 md:flex md:items-baseline md:gap-3">
        <div className="whitespace-nowrap text-[11px] font-semibold text-[var(--muted)] md:text-xs">
          {tr(`GW${gw} 마감 (한국 시간)`, `GW${gw} deadline (Korea time)`)}
        </div>
        <div className="whitespace-nowrap text-[15px] font-semibold md:text-lg">{KST_FORMATTERS[locale].format(new Date(deadline))}
          {locale === "en" ? " KST" : ""}
        </div>
      </div>
      <div
        aria-hidden="true"
        className={`hidden h-px min-w-8 flex-1 border-t border-dashed md:block ${
          urgent ? "border-amber-400" : "border-[var(--accent)]/40"
        }`}
      />
      <div className="text-right md:flex md:items-baseline md:gap-3">
        <div className="whitespace-nowrap text-[11px] font-semibold text-[var(--muted)] md:text-xs">
          {tr("남은 시간", "Time left")}
        </div>
        <div
          className={`whitespace-nowrap text-lg font-semibold tabular-nums leading-tight md:text-xl ${
            urgent ? "text-amber-800" : "text-[var(--accent)]"
          }`}
        >
          {passed ? (
            tr("마감됨", "Deadline passed")
          ) : (
            <>
              {left.days > 0 ? tr(`${left.days}일 `, `${left.days}d `) : ""}
              {left.days > 0 || left.hours > 0 ? tr(`${left.hours}시간 `, `${left.hours}h `) : ""}
              {tr(`${left.minutes}분`, `${left.minutes}m`)}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
