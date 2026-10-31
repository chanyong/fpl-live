"use client";

import { useEffect, useMemo, useState } from "react";
import { CaretDown, CaretRight } from "@/components/icons";
import { KpiCard, KpiGrid } from "@/components/kpi-card";
import { SidePanelLayout } from "@/components/side-panel-layout";
import { RemoteImage, crestUrl } from "@/components/remote-image";
import { hasFixtureEnded, isFixtureInPlay } from "@/lib/fixture-status";
import { fixtureBonusPreview } from "@/lib/bonus";
import { countdownLabel } from "@/lib/time-format";
import type { LeagueFixture, LeagueRow } from "@/lib/types";
import { useLocale } from "@/components/locale-provider";

/** Rows of a stat group shown before the "show all" toggle. */
const STAT_PREVIEW = 5;
const EMPTY_IDS = new Set<number>();

type Tr = <T = string>(ko: T, en: T) => T;

/**
 * Kickoffs follow the viewer's own time zone, spelled in the language on screen. The panel only
 * renders after the league data has loaded in the browser, so reading the zone here is safe.
 */
const DATE_FORMATTERS = {
  ko: new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric" }),
  en: new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" })
};

const WEEKDAY_FORMATTERS = {
  ko: new Intl.DateTimeFormat("ko-KR", { weekday: "short" }),
  en: new Intl.DateTimeFormat("en-GB", { weekday: "short" })
};

const TIME_FORMATTERS = {
  ko: new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false }),
  en: new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false })
};

function fixtureStatus(fixture: LeagueFixture, tr: Tr) {
  if (hasFixtureEnded(fixture)) {
    return tr("종료", "Finished");
  }

  if (isFixtureInPlay(fixture)) {
    return fixture.minutes > 0 ? `${tr("진행 중", "Live")} ${fixture.minutes}'` : tr("진행 중", "Live");
  }

  if (!fixture.kickoffTime) {
    return tr("미정", "TBC");
  }

  return tr("예정", "Upcoming");
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

/** "GMT+9" for the viewer's zone, so a clock time is never ambiguous. */
function zoneLabel(date: Date) {
  const part = new Intl.DateTimeFormat("en-GB", { timeZoneName: "short" })
    .formatToParts(date)
    .find((item) => item.type === "timeZoneName");

  return part?.value ?? "";
}

function formatDate(date: Date, locale: "ko" | "en") {
  const dateLabel = DATE_FORMATTERS[locale].format(date).replace(/\s+/g, " ").trim();
  const weekdayLabel = WEEKDAY_FORMATTERS[locale].format(date).replace(/\s+/g, "").trim();

  return locale === "ko" ? `${dateLabel}(${weekdayLabel})` : `${weekdayLabel} ${dateLabel}`;
}

function kickoffDateLabel(kickoffTime: string | null, tr: Tr, locale: "ko" | "en") {
  const date = toKstDate(kickoffTime);
  if (!date) {
    return tr("일정 미정", "Date TBC");
  }

  return formatDate(date, locale);
}

function kickoffDateTimeLabel(kickoffTime: string | null, tr: Tr, locale: "ko" | "en") {
  const date = toKstDate(kickoffTime);
  if (!date) {
    return tr("일정 미정", "Date TBC");
  }

  return `${formatDate(date, locale)} ${TIME_FORMATTERS[locale].format(date)} ${zoneLabel(date)}`;
}

type StatusFilter = "all" | "live" | "upcoming" | "ended";

function fixtureCategory(fixture: LeagueFixture): Exclude<StatusFilter, "all"> {
  if (hasFixtureEnded(fixture)) {
    return "ended";
  }

  return isFixtureInPlay(fixture) ? "live" : "upcoming";
}

const STATUS_FILTERS: Array<{ id: StatusFilter; ko: string; en: string }> = [
  { id: "all", ko: "전체", en: "All" },
  { id: "live", ko: "진행 중", en: "Live" },
  { id: "upcoming", ko: "예정", en: "Upcoming" },
  { id: "ended", ko: "종료", en: "Finished" }
];

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
  const { tr } = useLocale();
  const [showAll, setShowAll] = useState(false);
  const hidden = Math.max(home.length - STAT_PREVIEW, 0) + Math.max(away.length - STAT_PREVIEW, 0);

  const column = (items: StatSide) =>
    items.length === 0 ? (
      <div className="text-body text-[var(--muted)]">-</div>
    ) : (
      <div className="space-y-1">
        {(showAll ? items : items.slice(0, STAT_PREVIEW)).map((item) => {
          const owned = ownedElementIds.has(item.elementId);

          return (
            <div key={item.elementId} className="flex items-center justify-between gap-2 text-meta">
              <span
                className={`min-w-0 truncate ${owned ? "font-semibold text-[var(--accent)]" : ""}`}
                title={owned ? tr("우리 리그 보유 선수", "Owned in our league") : undefined}
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
      <div className="border-b border-[var(--border)] bg-amber-50 px-3 py-2 text-center text-caption font-semibold uppercase tracking-[0.14em] text-amber-800">
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
          className="w-full border-t border-[var(--border)] bg-stone-50 py-2 text-caption font-semibold text-[var(--accent)] transition hover:bg-stone-100"
        >
          {showAll ? tr("접기", "Show less") : tr(`${hidden}명 더 보기`, `Show ${hidden} more`)}
        </button>
      ) : null}
    </div>
  );
}

/** Who gets bonus in this match: FPL's own once published, otherwise 3-2-1 from live BPS. */
function BonusLine({ fixture, ownedElementIds }: { fixture: LeagueFixture; ownedElementIds: Set<number> }) {
  const { tr } = useLocale();
  const preview = fixtureBonusPreview(fixture);

  if (preview.status === "none" || preview.items.length === 0) {
    return null;
  }

  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-caption">
      <span
        className={`shrink-0 rounded-full px-1.5 py-0.5 font-semibold ${
          preview.status === "confirmed" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"
        }`}
        title={
          preview.status === "confirmed"
            ? tr("FPL이 확정한 보너스", "Bonus confirmed by FPL")
            : tr("실시간 BPS 순위로 계산한 예상 보너스(3·2·1점, 동점은 같은 점수)", "Projected from live BPS (3-2-1, ties share)")
        }
      >
        {preview.status === "confirmed" ? tr("보너스 확정", "Bonus") : tr("보너스 예상", "Proj. bonus")}
      </span>
      {preview.items.map((item) => (
        <span key={item.elementId} className={`whitespace-nowrap ${ownedElementIds.has(item.elementId) ? "font-semibold text-[var(--accent)]" : "text-[var(--muted)]"}`}>
          {item.playerName} <b className="tabular-nums text-[var(--text)]">+{item.bonus}</b>
          {item.bps !== null ? <span className="ml-0.5 tabular-nums opacity-70">({item.bps})</span> : null}
        </span>
      ))}
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
        fallbackClassName="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--surface-strong)] text-caption font-semibold text-[var(--muted)]"
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
  const { tr, locale } = useLocale();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  useEffect(() => {
    setSelectedId((current) => (current && fixtures.some((fixture) => fixture.id === current) ? current : null));
  }, [fixtures]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const ownership = useMemo(() => buildOwnership(rows, fixtures), [rows, fixtures]);

  const statusCounts = useMemo(() => {
    const counts = { all: fixtures.length, live: 0, upcoming: 0, ended: 0 };
    for (const fixture of fixtures) {
      counts[fixtureCategory(fixture)] += 1;
    }
    return counts;
  }, [fixtures]);

  const heldFixtures = useMemo(
    () => fixtures.filter((fixture) => (ownership.get(fixture.id)?.managerCount ?? 0) > 0).length,
    [fixtures, ownership]
  );

  const visibleFixtures = useMemo(
    () =>
      statusFilter === "all"
        ? fixtures
        : fixtures.filter((fixture) => fixtureCategory(fixture) === statusFilter),
    [fixtures, statusFilter]
  );

  const groupedFixtures = useMemo(() => {
    const groups = new Map<string, LeagueFixture[]>();

    for (const fixture of visibleFixtures) {
      const key = kickoffDateLabel(fixture.kickoffTime, tr, locale);
      const existing = groups.get(key) ?? [];
      existing.push(fixture);
      groups.set(key, existing);
    }

    return Array.from(groups.entries()).map(([label, items]) => ({ label, items }));
  }, [visibleFixtures, tr, locale]);

  if (fixtures.length === 0) {
    return (
      <section className="rounded-[1.2rem] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[0_12px_36px_rgba(55,40,20,0.07)]">
        <div className="text-body text-[var(--muted)]">
          {tr(`게임위크 ${currentGw} 경기가 없습니다.`, `No fixtures in gameweek ${currentGw}.`)}
        </div>
      </section>
    );
  }

  return (
    <SidePanelLayout
      side={
    <KpiGrid label={tr(`게임위크 ${currentGw} 경기 요약`, `Gameweek ${currentGw} fixtures summary`)}>
      <KpiCard
        label={tr("진행 중", "Live")}
        value={tr(`${statusCounts.live}경기`, String(statusCounts.live))}
        sub={tr("지금 뛰는 경기", "Matches in play")}
      />
      <KpiCard
        label={tr("예정", "Upcoming")}
        value={tr(`${statusCounts.upcoming}경기`, String(statusCounts.upcoming))}
        sub={tr("아직 킥오프 전", "Before kickoff")}
      />
      <KpiCard
        label={tr("종료", "Finished")}
        value={tr(`${statusCounts.ended}경기`, String(statusCounts.ended))}
        sub={`GW ${currentGw}`}
      />
      <KpiCard
        label={tr("리그 보유 경기", "League-owned matches")}
        value={`${heldFixtures}/${fixtures.length}`}
        sub={tr("우리 리그 선수가 뛰는 경기", "Our players are involved")}
      />
    </KpiGrid>
      }
    >
    <section className="rounded-[1.2rem] border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-[0_12px_36px_rgba(55,40,20,0.07)] md:p-2">
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-1.5 px-1.5">
        <div className="text-caption font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
          {tr(`게임위크 ${currentGw} 경기`, `Gameweek ${currentGw} fixtures`)}
        </div>
        <div role="group" aria-label={tr("경기 상태 필터", "Fixture status filter")} className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={statusFilter === item.id}
              onClick={() => setStatusFilter(item.id)}
              className={`min-h-9 shrink-0 whitespace-nowrap rounded-full border px-3 text-caption font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                statusFilter === item.id
                  ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-ink)]"
                  : "border-[var(--border)] bg-white text-[var(--muted)] hover:border-[var(--accent)]"
              }`}
            >
              {tr(item.ko, item.en)} <span className="tabular-nums">{statusCounts[item.id]}</span>
            </button>
          ))}
        </div>
      </div>

      {groupedFixtures.length === 0 ? (
        <div className="px-2 py-6 text-center text-body text-[var(--muted)]">
          {tr("해당하는 경기가 없습니다.", "No matching fixtures.")}
        </div>
      ) : null}

      <div className="space-y-4">
        {groupedFixtures.map((group) => (
          <div key={group.label} className="space-y-2">
            <div className="px-2 text-body-lg font-semibold text-[var(--muted)] md:text-title">{group.label}</div>
            <div className="grid gap-2 md:grid-cols-2">
              {group.items.map((fixture) => {
                const isSelected = fixture.id === selectedId;
                const owned = ownership.get(fixture.id);
                const topOwned = owned?.players[0];
                const countdown =
                  isFixtureInPlay(fixture) || hasFixtureEnded(fixture)
                    ? null
                    : countdownLabel(fixture.kickoffTime, now, locale);

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
                      <div className="flex items-center justify-between gap-2 text-caption text-[var(--muted)]">
                        <span className="min-w-0 truncate">
                          {kickoffDateTimeLabel(fixture.kickoffTime, tr, locale)}
                          {countdown ? (
                            <span className="ml-1.5 font-semibold text-[var(--accent)]">{countdown}</span>
                          ) : null}
                        </span>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 font-semibold ${fixtureStatusClass(fixture)}`}>
                          {fixtureStatus(fixture, tr)}
                        </span>
                      </div>

                      <div className="mt-1 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-body font-semibold md:text-body-lg">
                        <TeamLine name={fixture.homeTeam} code={fixture.homeCode} align="left" />
                        <span className="shrink-0 rounded-full bg-[var(--accent)]/10 px-3 py-1 text-meta tabular-nums text-[var(--accent)]">
                          {scoreLabel(fixture)}
                        </span>
                        <TeamLine name={fixture.awayTeam} code={fixture.awayCode} align="right" />
                      </div>

                      <div className="mt-1.5 flex items-center gap-1 text-caption text-[var(--muted)]">
                        <span className="shrink-0">{isSelected ? <CaretDown /> : <CaretRight />}</span>
                        {owned && owned.managerCount > 0 ? (
                          <span className="min-w-0 flex-1 truncate">
                            {tr("우리 리그", "Our league:")} <b className="font-semibold text-[var(--text)]">{tr(`${owned.managerCount}명`, String(owned.managerCount))}</b> {tr("보유", "own")}
                            {topOwned && topOwned.captains > 0 ? (
                              <span>
                                {" "}· {topOwned.webName} {tr("주장", "captained by")} {topOwned.captains}{tr("명", "")}
                              </span>
                            ) : null}
                          </span>
                        ) : (
                          <span>{tr("보유 선수 없음", "No owned players")}</span>
                        )}
                        {owned && owned.managerCount > 0 && rows.length > 0 ? (
                          <span
                            className="ml-auto flex shrink-0 items-center gap-1.5"
                            title={tr(
                              `리그 ${rows.length}명 중 ${owned.managerCount}명이 이 경기 선수를 보유`,
                              `${owned.managerCount} of ${rows.length} managers own a player in this match`
                            )}
                          >
                            <span className="tabular-nums">
                              {tr("보유율", "Owned")} <b className="font-semibold text-[var(--text)]">{Math.round((owned.managerCount / rows.length) * 100)}%</b>
                            </span>
                            <span aria-hidden="true" className="h-1.5 w-14 overflow-hidden rounded-full bg-[var(--chart-mute-soft)]">
                              <span
                                className="block h-full rounded-full bg-[var(--accent)]"
                                style={{ width: `${Math.round((owned.managerCount / rows.length) * 100)}%` }}
                              />
                            </span>
                          </span>
                        ) : null}
                      </div>
                      <BonusLine fixture={fixture} ownedElementIds={owned?.ownedElementIds ?? EMPTY_IDS} />
                    </button>

                    {isSelected ? (
                      <div className="border-t border-[var(--border)] bg-white/88 px-3 py-3">
                        {owned && owned.players.length > 0 ? (
                          <div className="rounded-[0.9rem] border border-[var(--border)] bg-white px-3 py-2.5">
                            <div className="text-caption font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                              {tr("우리 리그 보유 현황", "Owned in our league")}
                            </div>
                            <div className="mt-2 space-y-1">
                              {owned.players.slice(0, 6).map((player) => (
                                <div key={player.elementId} className="flex items-center justify-between gap-2 text-meta">
                                  <span className="min-w-0 truncate">
                                    {player.webName}
                                    <span className="ml-1 text-caption text-[var(--muted)]">{player.teamShortName}</span>
                                  </span>
                                  <span className="shrink-0 text-caption tabular-nums text-[var(--muted)]">
                                    {tr(`${player.owners}명`, String(player.owners))}
                                    {player.captains > 0 ? (
                                      <span className="ml-1 font-semibold text-rose-700">
                                        {tr("주장", "C")} {player.captains}
                                      </span>
                                    ) : null}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        <div className="mt-3 space-y-2">
                          {fixture.stats.length === 0 ? (
                            <div className="rounded-[0.9rem] border border-[var(--border)] bg-stone-50 px-3 py-3 text-body text-[var(--muted)]">
                              {tr("아직 선수 기록이 없습니다.", "No player stats yet.")}
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
    </SidePanelLayout>
  );
}
