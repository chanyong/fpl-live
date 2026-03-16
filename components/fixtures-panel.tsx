"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import type { LeagueFixture } from "@/lib/types";

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

  return format(new Date(fixture.kickoffTime), "EEE HH:mm");
}

function scoreLabel(fixture: LeagueFixture) {
  if (fixture.homeScore === null || fixture.awayScore === null) {
    return "- : -";
  }

  return `${fixture.homeScore} - ${fixture.awayScore}`;
}

export function FixturesPanel({ fixtures, currentGw }: { fixtures: LeagueFixture[]; currentGw: number }) {
  const [selectedId, setSelectedId] = useState<number | null>(fixtures[0]?.id ?? null);

  useEffect(() => {
    setSelectedId((current) => (current && fixtures.some((fixture) => fixture.id === current) ? current : fixtures[0]?.id ?? null));
  }, [fixtures]);

  const selectedFixture = useMemo(
    () => fixtures.find((fixture) => fixture.id === selectedId) ?? fixtures[0],
    [fixtures, selectedId]
  );

  if (fixtures.length === 0) {
    return (
      <section className="rounded-[1.2rem] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[0_12px_36px_rgba(55,40,20,0.07)]">
        <div className="text-sm text-[var(--muted)]">No fixtures found for Gameweek {currentGw}.</div>
      </section>
    );
  }

  return (
    <section className="space-y-3 md:space-y-4">
      <div className="rounded-[1.2rem] border border-[var(--border)] bg-[var(--surface)] p-2 shadow-[0_12px_36px_rgba(55,40,20,0.07)] md:p-3">
        <div className="mb-2 px-2 text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
          Gameweek {currentGw} Fixtures
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          {fixtures.map((fixture) => {
            const isSelected = fixture.id === selectedFixture?.id;
            return (
              <button
                key={fixture.id}
                type="button"
                onClick={() => setSelectedId(fixture.id)}
                className={`rounded-[1rem] border px-3 py-3 text-left transition ${
                  isSelected
                    ? "border-[var(--accent)] bg-[var(--accent-soft)]/55"
                    : "border-[var(--border)] bg-white hover:bg-stone-50"
                }`}
              >
                <div className="flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">
                  <span>{fixtureStatus(fixture)}</span>
                  <span>{fixture.kickoffTime ? format(new Date(fixture.kickoffTime), "MMM d") : ""}</span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2 text-[14px] font-semibold md:text-[15px]">
                  <span className="min-w-0 truncate">{fixture.homeTeam}</span>
                  <span className="shrink-0 rounded-full bg-[var(--surface-strong)] px-2 py-1 text-[13px]">{scoreLabel(fixture)}</span>
                  <span className="min-w-0 truncate text-right">{fixture.awayTeam}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {selectedFixture ? (
        <div className="rounded-[1.2rem] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[0_12px_36px_rgba(55,40,20,0.07)] md:p-5">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-[12px] uppercase tracking-[0.18em] text-[var(--muted)]">Match detail</div>
              <h2 className="mt-1 text-[1.35rem] font-semibold md:text-[1.55rem]">
                {selectedFixture.homeTeam} vs {selectedFixture.awayTeam}
              </h2>
              <div className="mt-1 text-[13px] text-[var(--muted)] md:text-sm">
                {fixtureStatus(selectedFixture)}
                {selectedFixture.kickoffTime ? ` · ${format(new Date(selectedFixture.kickoffTime), "EEE, MMM d HH:mm")}` : ""}
              </div>
            </div>
            <div className="text-[1.4rem] font-semibold tabular-nums md:text-[1.8rem]">{scoreLabel(selectedFixture)}</div>
          </div>

          <div className="mt-4 space-y-3">
            {selectedFixture.stats.length === 0 ? (
              <div className="rounded-2xl border border-[var(--border)] bg-white p-4 text-sm text-[var(--muted)]">
                No player stats available for this fixture yet.
              </div>
            ) : (
              selectedFixture.stats.map((stat) => (
                <div key={stat.key} className="overflow-hidden rounded-[1rem] border border-[var(--border)] bg-white">
                  <div className="border-b border-[var(--border)] bg-[var(--surface-strong)]/45 px-3 py-2 text-center text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
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
                              <span className="shrink-0 font-semibold tabular-nums">{item.value}</span>
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
                              <span className="shrink-0 font-semibold tabular-nums">{item.value}</span>
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
    </section>
  );
}