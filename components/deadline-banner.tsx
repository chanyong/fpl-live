"use client";

import { useEffect, useState } from "react";

const KST_FORMATTER = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "long",
  day: "numeric",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false
});

/** "2일 3시간 15분" — whole units left until the deadline, never rounded up. */
function remainingParts(deadline: number, now: number) {
  const minutes = Math.max(0, Math.floor((deadline - now) / 60_000));

  return { days: Math.floor(minutes / 1440), hours: Math.floor((minutes % 1440) / 60), minutes: minutes % 60 };
}

export function DeadlineBanner({ gw, deadlineTime }: { gw: number; deadlineTime: string }) {
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
      aria-label={`게임위크 ${gw} 마감`}
      className={`mb-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-0.5 rounded-xl border px-3 py-2 ${
        urgent ? "border-amber-300 bg-amber-50" : "border-[var(--border)] bg-[var(--surface)]"
      }`}
    >
      <div className="min-w-0">
        <div className="text-[11px] font-semibold text-[var(--muted)]">GW{gw} 마감 (한국 시간)</div>
        <div className="text-[15px] font-semibold md:text-base">{KST_FORMATTER.format(new Date(deadline))}</div>
      </div>
      <div className="text-right">
        <div className="text-[11px] font-semibold text-[var(--muted)]">남은 시간</div>
        <div
          className={`text-lg font-semibold tabular-nums leading-tight md:text-xl ${
            urgent ? "text-amber-800" : "text-[var(--accent)]"
          }`}
        >
          {passed ? (
            "마감됨"
          ) : (
            <>
              {left.days > 0 ? `${left.days}일 ` : ""}
              {left.days > 0 || left.hours > 0 ? `${left.hours}시간 ` : ""}
              {left.minutes}분
            </>
          )}
        </div>
      </div>
    </section>
  );
}
