"use client";

import { useEffect, useMemo, useState } from "react";
import type { LeagueFixture } from "@/lib/types";

const KOREAN_DATE_FORMATTER = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "long",
  day: "numeric"
});

const KOREAN_WEEKDAY_FORMATTER = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  weekday: "short"
});

const KOREAN_TIME_FORMATTER = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false
});

function fixtureStatus(fixture: LeagueFixture) {
  if (fixture.finished) {
    return "FT";
  }

  if (fixture.started) {
    return "LIVE";
  }

  if (!fixture.kickoffTime) {
    return "TBD";
  }

  return "UPCOMING";
}

function fixtureStatusClass(fixture: LeagueFixture) {
  if (fixture.finished) {
    return "bg-emerald-100 text-emerald-800";
  }

  if (fixture.started) {
    return "bg-amber-100 text-amber-800";
  }

  return "bg-stone-100 text-stone-700";
}

function scoreLabel(fixture: LeagueFixture) {
  if (fixture.homeScore === null || fixture.awayScore === null) {
    return "- : -";
  }

  return `${fixture.homeScore} - ${fixture.awayScore}`;
}

function toKstDate(kickoffTime: string | null) {
  if (!kickoffTime) {
    return null;
  }

  return new Date(kickoffTime);
}

function formatKoreanDate(date: Date) {
  const dateLabel = KOREAN_DATE_FORMATTER.format(date).replace(/\s+/g, " ").trim();
  const weekdayLabel = KOREAN_WEEKDAY_FORMATTER.format(date).replace(/\s+/g, "").trim();

  return `${dateLabel}(${weekdayLabel})`;
}

function kickoffDateLabel(kickoffTime: string | null) {
  const date = toKstDate(kickoffTime);
  if (!date) {
    return "일정 미정";
  }

  return formatKoreanDate(date);
}

function kickoffDateTimeLabel(kickoffTime: string | null) {
  const date = toKstDate(kickoffTime);
  if (!date) {
    return "일정 미정";
  }

  return `${formatKoreanDate(date)} ${KOREAN_TIME_FORMATTER.format(date)} KST`;
}

export function FixturesPanel({ fixtures, currentGw }: { fixtures: LeagueFixture[]; currentGw: number }) {
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    setSelectedId((current) => (current && fixtures.some((fixture) => fixture.id === current) ? current : null));
  }, [fixtures]);

  const groupedFixtures = useMemo(() => {
    const groups = new Map<string, LeagueFixture[]>();

    for (const fixture of fixtures) {
      const key = kickoffDateLabel(fixture.kickoffTime);
      const existing = groups.get(key) ?? [];
      existing.push(fixture);
      groups.set(key, existing);
    }

    return Array.from(groups.entries()).map(([label, items]) => ({ label, items }));
  }, [fixtures]);

  if (fixtures.length === 0) {
    return (
      <section className="rounded-[1.2rem] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[0_12px_36px_rgba(55,40,20,0.07)]">
        <div className="text-sm text-[var(--muted)]">No fixtures found for Gameweek {currentGw}.</div>
      </section>
    );
  }

  return (
    <section className="rounded-[1.2rem] border border-[var(--border)] bg-[var(--surface)] p-2 shadow-[0_12px_36px_rgba(55,40,20,0.07)] md:p-3">
      <div className="mb-2 px-2 text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
        Gameweek {currentGw} Fixtures
      </div>

      <div className="space-y-4">
        {groupedFixtures.map((group) => (
          <div key={group.label} className="space-y-2">
            <div className="px-2 text-[16px] font-semibold text-[var(--muted)] md:text-[17px]">{group.label}</div>
            <div className="grid gap-2 md:grid-cols-2">
              {group.items.map((fixture) => {
                const isSelected = fixture.id === selectedId;

                return (
                  <article
                    key={fixture.id}
                    className={`overflow-hidden rounded-[1rem] border transition ${
                      isSelected
                        ? "border-[var(--accent)] bg-[var(--accent-soft)]/35"
                        : "border-[var(--border)] bg-white"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedId((current) => (current === fixture.id ? null : fixture.id))}
                      className="w-full px-3 py-3 text-left"
                    >
                      <div className="flex items-center justify-start gap-3 text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">
                        <span className={`rounded-full px-2 py-1 font-semibold ${fixtureStatusClass(fixture)}`}>{fixtureStatus(fixture)}</span>
                      </div>
                      <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-[14px] font-semibold md:text-[15px]">
                        <span className="min-w-0 truncate">{fixture.homeTeam}</span>
                        <span className="shrink-0 rounded-full bg-[var(--accent)]/10 px-3 py-1 text-[13px] text-[var(--accent)]">
                          {scoreLabel(fixture)}
                        </span>
                        <span className="min-w-0 truncate text-right">{fixture.awayTeam}</span>
                      </div>
                      <div className="mt-2 text-[12px] text-[var(--muted)]">{kickoffDateTimeLabel(fixture.kickoffTime)}</div>
                    </button>

                    {isSelected ? (
                      <div className="border-t border-[var(--border)] bg-white/88 px-3 py-3">
                        <div className="rounded-[0.9rem] border border-emerald-200 bg-emerald-50/60 px-3 py-2">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-800">Match detail</div>
                          <div className="mt-1 text-sm font-semibold text-stone-900">
                            {fixture.homeTeam} vs {fixture.awayTeam}
                          </div>
                          <div className="mt-1 text-[12px] text-[var(--muted)]">
                            {fixtureStatus(fixture)} ? {kickoffDateTimeLabel(fixture.kickoffTime)}
                          </div>
                        </div>

                        <div className="mt-3 space-y-2">
                          {fixture.stats.length === 0 ? (
                            <div className="rounded-[0.9rem] border border-[var(--border)] bg-stone-50 px-3 py-3 text-sm text-[var(--muted)]">
                              No player stats available for this fixture yet.
                            </div>
                          ) : (
                            fixture.stats.map((stat) => (
                              <div key={stat.key} className="overflow-hidden rounded-[0.9rem] border border-[var(--border)] bg-white">
                                <div className="border-b border-[var(--border)] bg-amber-50 px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-800">
                                  {stat.label}
                                </div>
                                <div className="grid grid-cols-2 gap-px bg-[var(--border)]">
                                  <div className="bg-white px-3 py-3">
                                    {stat.home.length === 0 ? (
                                      <div className="text-sm text-[var(--muted)]">-</div>
                                    ) : (
                                      <div className="space-y-1.5">
                                        {stat.home.map((item) => (
                                          <div key={`${stat.key}-h-${item.elementId}`} className="flex items-center justify-between gap-2 text-sm">
                                            <span className="min-w-0 truncate">{item.playerName}</span>
                                            <span className="shrink-0 font-semibold tabular-nums text-stone-700">{item.value}</span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                  <div className="bg-white px-3 py-3">
                                    {stat.away.length === 0 ? (
                                      <div className="text-sm text-[var(--muted)]">-</div>
                                    ) : (
                                      <div className="space-y-1.5">
                                        {stat.away.map((item) => (
                                          <div key={`${stat.key}-a-${item.elementId}`} className="flex items-center justify-between gap-2 text-sm">
                                            <span className="min-w-0 truncate">{item.playerName}</span>
                                            <span className="shrink-0 font-semibold tabular-nums text-stone-700">{item.value}</span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
