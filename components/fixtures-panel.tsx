"use client";

import { useEffect, useMemo, useState } from "react";
import { CaretDown, CaretRight } from "@/components/icons";
import { RemoteImage, crestUrl } from "@/components/remote-image";
import { hasFixtureEnded, isFixtureInPlay } from "@/lib/fixture-status";
import { countdownLabel } from "@/lib/time-format";
import type { LeagueFixture, LeagueRow } from "@/lib/types";

/** Rows of a stat group shown before the "show all" toggle. */
const STAT_PREVIEW = 5;

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
  if (hasFixtureEnded(fixture)) {
    return "종료";
  }

  if (isFixtureInPlay(fixture)) {
    return "진행 중";
  }

  if (!fixture.kickoffTime) {
    return "미정";
  }

  return "예정";
}

function fixtureStatusClass(fixture: LeagueFixture) {
  if (hasFixtureEnded(fixture)) {
    return "bg-emerald-100 text-emerald-800";
  }

  if (isFixtureInPlay(fixture)) {
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

type OwnedPlayer = {
  elementId: number;
  webName: string;
  teamShortName: string;
  owners: number;
  captains: number;
};

type FixtureOwnership = {
  managerCount: number;
  players: OwnedPlayer[];
  ownedElementIds: Set<number>;
};

/**
 * Who in this league holds the players on the pitch.
 *
 * Every manager's full squad already ships with the standings payload, so this
 * is a local join with no extra request. Teams match on short name, the one
 * identifier carried by both a squad card and a fixture.
 */
function buildOwnership(rows: LeagueRow[], fixtures: LeagueFixture[]) {
  const byFixture = new Map<number, FixtureOwnership>();

  for (const fixture of fixtures) {
    const sides = new Set([fixture.homeShortName, fixture.awayShortName]);
    const owners = new Map<number, OwnedPlayer>();
    const managers = new Set<number>();

    for (const row of rows) {
      for (const player of [...row.squad.starters, ...row.squad.bench]) {
        if (!sides.has(player.teamShortName)) {
          continue;
        }

        managers.add(row.entryId);
        const existing = owners.get(player.elementId) ?? {
          elementId: player.elementId,
          webName: player.webName,
          teamShortName: player.teamShortName,
          owners: 0,
          captains: 0
        };
        existing.owners += 1;
        if (player.isCaptain) {
          existing.captains += 1;
        }
        owners.set(player.elementId, existing);
      }
    }

    byFixture.set(fixture.id, {
      managerCount: managers.size,
      players: [...owners.values()].sort(
        (left, right) => right.owners - left.owners || right.captains - left.captains
      ),
      ownedElementIds: new Set(owners.keys())
    });
  }

  return byFixture;
}

type StatSide = LeagueFixture["stats"][number]["home"];

function StatGroup({
  label,
  home,
  away,
  ownedElementIds
}: {
  label: string;
  home: StatSide;
  away: StatSide;
  ownedElementIds: Set<number>;
}) {
  const [showAll, setShowAll] = useState(false);
  const hidden = Math.max(home.length - STAT_PREVIEW, 0) + Math.max(away.length - STAT_PREVIEW, 0);

  const column = (items: StatSide) =>
    items.length === 0 ? (
      <div className="text-sm text-[var(--muted)]">-</div>
    ) : (
      <div className="space-y-1">
        {(showAll ? items : items.slice(0, STAT_PREVIEW)).map((item) => {
          const owned = ownedElementIds.has(item.elementId);

          return (
            <div key={item.elementId} className="flex items-center justify-between gap-2 text-[13px]">
              <span
                className={`min-w-0 truncate ${owned ? "font-semibold text-[var(--accent)]" : ""}`}
                title={owned ? "우리 리그 보유 선수" : undefined}
              >
                {item.playerName}
              </span>
              <span className="shrink-0 font-semibold tabular-nums">{item.value}</span>
            </div>
          );
        })}
      </div>
    );

  return (
    <div className="overflow-hidden rounded-[0.9rem] border border-[var(--border)] bg-white">
      <div className="border-b border-[var(--border)] bg-amber-50 px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-800">
        {label}
      </div>
      <div className="grid grid-cols-2 gap-px bg-[var(--border)]">
        <div className="bg-white px-3 py-3">{column(home)}</div>
        <div className="bg-white px-3 py-3">{column(away)}</div>
      </div>
      {hidden > 0 ? (
        <button
          type="button"
          onClick={() => setShowAll((current) => !current)}
          className="w-full border-t border-[var(--border)] bg-stone-50 py-2 text-[12px] font-semibold text-[var(--accent)] transition hover:bg-stone-100"
        >
          {showAll ? "접기" : `${hidden}명 더 보기`}
        </button>
      ) : null}
    </div>
  );
}

function TeamLine({ name, code, align }: { name: string; code: number; align: "left" | "right" }) {
  return (
    <span className={`flex min-w-0 items-center gap-1.5 ${align === "right" ? "flex-row-reverse" : ""}`}>
      <RemoteImage
        src={crestUrl(code)}
        alt=""
        fallback={name.slice(0, 1)}
        className="h-5 w-5 shrink-0 object-contain"
        fallbackClassName="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--surface-strong)] text-[9px] font-semibold text-[var(--muted)]"
      />
      <span className="min-w-0 truncate">{name}</span>
    </span>
  );
}

export function FixturesPanel({
  fixtures,
  currentGw,
  rows
}: {
  fixtures: LeagueFixture[];
  currentGw: number;
  rows: LeagueRow[];
}) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setSelectedId((current) => (current && fixtures.some((fixture) => fixture.id === current) ? current : null));
  }, [fixtures]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const ownership = useMemo(() => buildOwnership(rows, fixtures), [rows, fixtures]);

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
        <div className="text-sm text-[var(--muted)]">게임위크 {currentGw} 경기가 없습니다.</div>
      </section>
    );
  }

  return (
    <section className="rounded-[1.2rem] border border-[var(--border)] bg-[var(--surface)] p-2 shadow-[0_12px_36px_rgba(55,40,20,0.07)] md:p-3">
      <div className="mb-2 px-2 text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
        게임위크 {currentGw} 경기
      </div>

      <div className="space-y-4">
        {groupedFixtures.map((group) => (
          <div key={group.label} className="space-y-2">
            <div className="px-2 text-[16px] font-semibold text-[var(--muted)] md:text-[17px]">{group.label}</div>
            <div className="grid gap-2 md:grid-cols-2">
              {group.items.map((fixture) => {
                const isSelected = fixture.id === selectedId;
                const owned = ownership.get(fixture.id);
                const topOwned = owned?.players[0];
                const countdown =
                  isFixtureInPlay(fixture) || hasFixtureEnded(fixture)
                    ? null
                    : countdownLabel(fixture.kickoffTime, now);

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
                      aria-expanded={isSelected}
                      onClick={() => setSelectedId((current) => (current === fixture.id ? null : fixture.id))}
                      className="w-full px-3 py-2 text-left focus:outline-none focus-visible:bg-[var(--accent-soft)]"
                    >
                      <div className="flex items-center justify-between gap-2 text-[11px] text-[var(--muted)]">
                        <span className="min-w-0 truncate">
                          {kickoffDateTimeLabel(fixture.kickoffTime)}
                          {countdown ? (
                            <span className="ml-1.5 font-semibold text-[var(--accent)]">{countdown}</span>
                          ) : null}
                        </span>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 font-semibold ${fixtureStatusClass(fixture)}`}>
                          {fixtureStatus(fixture)}
                        </span>
                      </div>

                      <div className="mt-1 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-[14px] font-semibold md:text-[15px]">
                        <TeamLine name={fixture.homeTeam} code={fixture.homeCode} align="left" />
                        <span className="shrink-0 rounded-full bg-[var(--accent)]/10 px-3 py-1 text-[13px] tabular-nums text-[var(--accent)]">
                          {scoreLabel(fixture)}
                        </span>
                        <TeamLine name={fixture.awayTeam} code={fixture.awayCode} align="right" />
                      </div>

                      <div className="mt-1.5 flex items-center gap-1 text-[11px] text-[var(--muted)]">
                        <span className="shrink-0">{isSelected ? <CaretDown /> : <CaretRight />}</span>
                        {owned && owned.managerCount > 0 ? (
                          <span className="min-w-0 truncate">
                            우리 리그 <b className="font-semibold text-[var(--text)]">{owned.managerCount}명</b> 보유
                            {topOwned && topOwned.captains > 0 ? (
                              <span> · {topOwned.webName} 주장 {topOwned.captains}명</span>
                            ) : null}
                          </span>
                        ) : (
                          <span>보유 선수 없음</span>
                        )}
                      </div>
                    </button>

                    {isSelected ? (
                      <div className="border-t border-[var(--border)] bg-white/88 px-3 py-3">
                        {owned && owned.players.length > 0 ? (
                          <div className="rounded-[0.9rem] border border-[var(--border)] bg-white px-3 py-2.5">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                              우리 리그 보유 현황
                            </div>
                            <div className="mt-2 space-y-1">
                              {owned.players.slice(0, 6).map((player) => (
                                <div key={player.elementId} className="flex items-center justify-between gap-2 text-[13px]">
                                  <span className="min-w-0 truncate">
                                    {player.webName}
                                    <span className="ml-1 text-[11px] text-[var(--muted)]">{player.teamShortName}</span>
                                  </span>
                                  <span className="shrink-0 text-[12px] tabular-nums text-[var(--muted)]">
                                    {player.owners}명
                                    {player.captains > 0 ? (
                                      <span className="ml-1 font-semibold text-rose-700">주장 {player.captains}</span>
                                    ) : null}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        <div className="mt-3 space-y-2">
                          {fixture.stats.length === 0 ? (
                            <div className="rounded-[0.9rem] border border-[var(--border)] bg-stone-50 px-3 py-3 text-sm text-[var(--muted)]">
                              아직 선수 기록이 없습니다.
                            </div>
                          ) : (
                            fixture.stats.map((stat) => (
                              <StatGroup
                                key={stat.key}
                                label={stat.label}
                                home={stat.home}
                                away={stat.away}
                                ownedElementIds={owned?.ownedElementIds ?? new Set<number>()}
                              />
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
