"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/components/locale-provider";

/**
 * The deadline is shown in the viewer's own time zone, so someone in London and someone in
 * Seoul each read it as their own clock. The zone is read from the browser, which is safe here
 * because the banner only renders after the league data has loaded on the client.
 */
const LOCAL_FORMATTERS = {
  ko: new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }),
  en: new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  })
};

/** "GMT+9" for the viewer's zone, so the clock time is never ambiguous. */
function zoneLabel(date: Date) {
  const part = new Intl.DateTimeFormat("en-GB", { timeZoneName: "short" })
    .formatToParts(date)
    .find((item) => item.type === "timeZoneName");

  return part?.value ?? "";
}

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
      className={`mb-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-0.5 rounded-md border px-3 py-2 md:flex-nowrap md:gap-x-3 md:py-1.5 ${
        urgent
          ? "border-amber-500 bg-amber-50"
          : "border-[var(--border)] bg-[var(--surface-strong)]"
      }`}
    >
      <div className="min-w-0 md:flex md:items-baseline md:gap-3">
        <div className="whitespace-nowrap text-caption font-semibold text-[var(--muted)] md:text-caption">
          <span className="text-body-lg font-extrabold text-[var(--text)] md:text-body-lg">GW{gw}</span>{" "}
          {tr("마감", "deadline")}
        </div>
        <div className="whitespace-nowrap text-body-lg font-semibold md:text-lg">
          {LOCAL_FORMATTERS[locale].format(new Date(deadline))}
          <span className="ml-1.5 text-caption font-medium text-[var(--muted)] md:text-caption">
            {zoneLabel(new Date(deadline))}
          </span>
        </div>
      </div>
      <div
        aria-hidden="true"
        className={`hidden h-px min-w-8 flex-1 border-t border-dashed md:block ${
          urgent ? "border-amber-400" : "border-[var(--border)]"
        }`}
      />
      <div className="text-right md:flex md:items-baseline md:gap-3">
        <div className="whitespace-nowrap text-caption font-semibold text-[var(--muted)] md:text-caption">
          {tr("남은 시간", "Time left")}
        </div>
        <div
          className={`whitespace-nowrap text-lg font-semibold tabular-nums leading-tight md:text-xl ${
            urgent ? "text-amber-800" : "text-[var(--accent-ink)]"
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
