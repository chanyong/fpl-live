"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ChartScroll } from "@/components/charts/chart-scroll";
import { CaretDown, CaretRight } from "@/components/icons";
import { KpiCard, KpiGrid } from "@/components/kpi-card";
import { SidePanelLayout } from "@/components/side-panel-layout";
import { ChipStatusPanel } from "@/components/chip-status-panel";
import { RankDelta } from "@/components/rank-delta";
import { formatMoney } from "@/lib/season-summary";
import type { RankChangeManager, RankChangePoint, RankChangeResponse } from "@/lib/types";
import { useLocale } from "@/components/locale-provider";

/** Below this many tracked gameweeks a trend line says nothing, so we show a table instead. */
const MIN_GW_FOR_CHART = 2;
/** Season stats need a sample before they mean anything. */
const MIN_GW_FOR_STATS = 3;
const STAT_LIMIT = 5;

type TrendManager = RankChangeManager & {
  /** trend aligned to the shared gameweek axis, with gaps as null */
  full: Array<RankChangePoint | null>;
};

type StatItem = {
  entry: number;
  entryName: string;
  playerName: string;
  value: number;
  gw?: number;
};

function buildSeasonTrend(managers: RankChangeManager[], gameweeks: number[]): TrendManager[] {
  return managers.map((manager) => {
    const points = manager.trend.filter((row): row is RankChangePoint => Boolean(row));
    const byGw = new Map(points.map((row) => [row.gw, row]));

    return {
      ...manager,
      full: gameweeks.map((gw) => byGw.get(gw) ?? null)
    };
  });
}

function buildLeagueStats(managers: TrendManager[]) {
  const firstPlaceCounts = new Map<number, number>();
  const secondPlaceCounts = new Map<number, number>();
  const weeklyHighScores: StatItem[] = [];
  const weeklyRankJumps: StatItem[] = [];
  const averageEventScores: StatItem[] = [];
  const podiumCounts = new Map<number, number>();
  const consistentTopFiveCounts = new Map<number, number>();
  const bestTotalPoints: StatItem[] = [];
  const lowestAverageRank: StatItem[] = [];

  managers.forEach((manager) => {
    const validTrend = manager.trend.filter((row): row is RankChangePoint => Boolean(row));
    const identity = { entry: manager.entry, entryName: manager.entryName, playerName: manager.playerName };
    let podium = 0;
    let topFive = 0;

    averageEventScores.push({
      ...identity,
      value: Number(
        (validTrend.reduce((sum, row) => sum + row.eventPoints, 0) / Math.max(validTrend.length, 1)).toFixed(1)
      )
    });

    lowestAverageRank.push({
      ...identity,
      value: Number((validTrend.reduce((sum, row) => sum + row.rank, 0) / Math.max(validTrend.length, 1)).toFixed(2))
    });

    bestTotalPoints.push({ ...identity, value: manager.totalPoints });

    validTrend.forEach((row, index) => {
      if (row.rank === 1) {
        firstPlaceCounts.set(manager.entry, (firstPlaceCounts.get(manager.entry) || 0) + 1);
      }
      if (row.rank === 2) {
        secondPlaceCounts.set(manager.entry, (secondPlaceCounts.get(manager.entry) || 0) + 1);
      }
      if (row.rank <= 3) podium += 1;
      if (row.rank <= 5) topFive += 1;

      weeklyHighScores.push({ ...identity, gw: row.gw, value: row.eventPoints });

      if (index > 0) {
        weeklyRankJumps.push({ ...identity, gw: row.gw, value: validTrend[index - 1].rank - row.rank });
      }
    });

    podiumCounts.set(manager.entry, podium);
    consistentTopFiveCounts.set(manager.entry, topFive);
  });

  function mapCountRanking(counter: Map<number, number>) {
    return managers
      .map((manager) => ({
        entry: manager.entry,
        entryName: manager.entryName,
        playerName: manager.playerName,
        value: counter.get(manager.entry) || 0
      }))
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value || a.entryName.localeCompare(b.entryName))
      .slice(0, STAT_LIMIT);
  }

  const seasonRanking = (
    pick: (manager: TrendManager) => number | null,
    order: "asc" | "desc"
  ) =>
    managers
      .map((manager) => ({
        entry: manager.entry,
        entryName: manager.entryName,
        playerName: manager.playerName,
        value: pick(manager)
      }))
      .filter((item): item is StatItem => item.value !== null && item.value > 0)
      .sort((a, b) => (order === "desc" ? b.value - a.value : a.value - b.value))
      .slice(0, STAT_LIMIT);

  return {
    trackedGameweeks: Math.max(
      ...managers.map((manager) => manager.trend.filter(Boolean).length),
      0
    ),
    benchWasteTop: seasonRanking((manager) => manager.season.pointsOnBench, "desc"),
    hitCostTop: seasonRanking((manager) => manager.season.transferCost, "desc"),
    squadValueTop: seasonRanking((manager) => manager.season.squadValue, "desc"),
    overallRankTop: seasonRanking((manager) => manager.season.overallRank, "asc"),
    veteranBestTop: seasonRanking(
      (manager) =>
        manager.season.pastSeasons.length > 0
          ? Math.min(...manager.season.pastSeasons.map((season) => season.rank))
          : null,
      "asc"
    ),
    firstPlaceTop: mapCountRanking(firstPlaceCounts),
    secondPlaceTop: mapCountRanking(secondPlaceCounts),
    podiumTop: mapCountRanking(podiumCounts),
    topFiveTop: mapCountRanking(consistentTopFiveCounts),
    weeklyHighScoresTop: weeklyHighScores
      .sort((a, b) => b.value - a.value || (a.gw || 0) - (b.gw || 0))
      .slice(0, STAT_LIMIT),
    averageEventPointsTop: averageEventScores.sort((a, b) => b.value - a.value).slice(0, STAT_LIMIT),
    averageRankTop: lowestAverageRank.sort((a, b) => a.value - b.value).slice(0, STAT_LIMIT),
    bestTotalPointsTop: bestTotalPoints.sort((a, b) => b.value - a.value).slice(0, STAT_LIMIT),
    rankJumpTop: weeklyRankJumps
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value || (a.gw || 0) - (b.gw || 0))
      .slice(0, STAT_LIMIT)
  };
}

/**
 * A card whose body folds away. Phones start folded so the long record lists do not bury the
 * chart; wider screens start open. The choice is made after mount to keep hydration stable.
 */
function CollapsibleSection({
  title,
  subtitle,
  children
}: {
  title: string;
  subtitle: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(window.matchMedia("(min-width: 768px)").matches);
  }, []);

  return (
    <section className="rounded-md border border-[var(--border)] bg-[var(--surface)] p-3">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-start justify-between gap-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
      >
        <span className="min-w-0">
          <span className="block text-body-lg font-semibold">{title}</span>
          <span className="block text-caption text-[var(--muted)]">{subtitle}</span>
        </span>
        <span className="mt-1 shrink-0 text-[var(--muted)]">{open ? <CaretDown /> : <CaretRight />}</span>
      </button>
      {open ? <div className="mt-3">{children}</div> : null}
    </section>
  );
}

function StatCard({
  title,
  subtitle,
  items,
  formatter
}: {
  title: string;
  subtitle: string;
  items: StatItem[];
  formatter: (item: StatItem) => string;
}) {
  const { tr } = useLocale();
  return (
    <article className="rounded-md border border-[var(--border)] bg-[var(--bg)] p-3">
      <div className="text-body-lg font-semibold">{title}</div>
      <div className="mt-1 text-caption text-[var(--muted)]">{subtitle}</div>
      <div className="mt-3 grid gap-2">
        {items.length ? (
          items.map((item, index) => (
            <div
              key={`${item.entry}-${index}`}
              className="grid grid-cols-[26px_minmax(0,1fr)_auto] items-center gap-2 border-t border-stone-100 pt-2 first:border-t-0 first:pt-0"
            >
              <div className="grid h-[26px] w-[26px] place-items-center rounded-full bg-[var(--accent)]/10 text-caption font-semibold text-[var(--accent)]">
                {index + 1}
              </div>
              <div className="min-w-0">
                <div className="truncate text-meta font-semibold">{item.entryName}</div>
                <div className="truncate text-caption text-[var(--muted)]">{item.playerName}</div>
              </div>
              <div className="text-right text-caption font-semibold text-[var(--accent)]">{formatter(item)}</div>
            </div>
          ))
        ) : (
          <div className="text-caption text-[var(--muted)]">{tr("데이터가 없습니다.", "No data.")}</div>
        )}
      </div>
    </article>
  );
}

/**
 * Spreads labels that would otherwise land on the same y.
 *
 * Managers tied on points share a rank, so their lines end at an identical
 * coordinate and the names render on top of one another.
 */
/** Spaces end-of-line labels at least `minGap` apart, never below `maxY` (tied last places included). */
export function spreadLabels(entries: Array<{ key: number; y: number }>, minGap: number, maxY = Number.POSITIVE_INFINITY) {
  const sorted = [...entries].sort((left, right) => left.y - right.y);
  const ys: number[] = [];
  let previous = Number.NEGATIVE_INFINITY;

  for (const entry of sorted) {
    const y = Math.max(entry.y, previous + minGap);
    ys.push(y);
    previous = y;
  }
  // A run pushed past the bottom moves back up as a block, keeping the gap.
  for (let index = ys.length - 1; index >= 0; index -= 1) {
    const limit = index === ys.length - 1 ? maxY : ys[index + 1] - minGap;
    ys[index] = Math.min(ys[index], limit);
  }

  const placed = new Map<number, number>();
  sorted.forEach((entry, index) => placed.set(entry.key, ys[index]));
  return placed;
}

// The name column right of the chart is padding.right - 11 = 139 units wide.
const NAME_WIDTH = 139;
const ELLIPSIS_WIDTH = 8;

/** Rough width of bold 13px Manrope: Hangul/CJK about 13 units, capitals and digits 9, spaces 3.5, the rest 6.9. */
function nameWidth(chars: string[]) {
  return chars.reduce(
    (sum, char) =>
      sum +
      (/[\u1100-\u11ff\u3000-\u9fff\uac00-\ud7af\uf900-\ufaff]|\p{Extended_Pictographic}/u.test(char)
        ? 13
        : /[A-Z0-9]/.test(char)
          ? 9
          : char === " "
            ? 3.5
            : 6.9),
    0
  );
}

/** Shortens a manager name to fit the label column, by estimated width and whole characters. */
export function chartName(name: string) {
  const chars = Array.from(name);
  if (nameWidth(chars) <= NAME_WIDTH) return name;
  while (chars.length > 1 && nameWidth(chars) + ELLIPSIS_WIDTH > NAME_WIDTH) chars.pop();
  return `${chars.join("").trimEnd()}…`;
}

function TrendChart({
  managers,
  gameweeks,
  totalManagers,
  headerRight
}: {
  managers: TrendManager[];
  gameweeks: number[];
  totalManagers: number;
  headerRight?: ReactNode;
}) {
  const { tr } = useLocale();
  // Tapping or hovering a gameweek column lists everyone's rank for it below the chart,
  // which works the same with a finger as with a mouse.
  const [pickedGw, setPickedGw] = useState<number | null>(null);
  const activeGw =
    pickedGw !== null && gameweeks.includes(pickedGw) ? pickedGw : gameweeks[gameweeks.length - 1];
  const activeIndex = gameweeks.indexOf(activeGw);
  const activeRows = managers
    .map((manager) => ({ manager, point: manager.full[activeIndex] }))
    .filter((item): item is { manager: TrendManager; point: RankChangePoint } => Boolean(item.point))
    .sort((a, b) => a.point.rank - b.point.rank || b.point.totalPoints - a.point.totalPoints);

  const width = Math.max(760, 150 + gameweeks.length * 32);
  const height = Math.max(300, 120 + totalManagers * 20);
  const padding = { top: 24, right: 150, bottom: 42, left: 48 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const maxRank = Math.max(totalManagers, 1);
  const stepX = gameweeks.length > 1 ? innerWidth / (gameweeks.length - 1) : 0;
  const getX = (index: number) => padding.left + stepX * index;
  const getY = (rank: number) => padding.top + ((rank - 1) / Math.max(maxRank - 1, 1)) * innerHeight;

  const series = managers
    .map((manager) => {
      const points = manager.full
        .map((row, index) => (row ? { x: getX(index), y: getY(row.rank) } : null))
        .filter((point): point is { x: number; y: number } => Boolean(point));

      return { manager, points };
    })
    .filter((item) => item.points.length > 0);

  // 15 apart so neighbouring 13px bold names do not touch, and no lower than 12 below the last rank
  // line so tied last places stay clear of the GW labels.
  const labelY = spreadLabels(
    series.map((item) => ({ key: item.manager.entry, y: item.points[item.points.length - 1].y })),
    15,
    height - padding.bottom + 12
  );
  // "GW38" at 13px is about 36 units wide; closer than 40 apart, print every other one (always the latest).
  const gwLabelEvery = stepX > 0 && stepX < 40 ? 2 : 1;

  return (
    <section className="rounded-md border border-[var(--border)] bg-[var(--surface)] p-3 md:p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-title font-semibold">{tr("개인별 순위 변화", "Rank by manager")}</div>
          <div className="text-caption leading-5 text-[var(--muted)]">
            {tr("GW를 누르면 그 주 순위가 나옵니다.", "Tap a GW for that week's ranks.")}
          </div>
        </div>
        {headerRight}
      </div>
      <ChartScroll className="pb-1" resetKey={`${gameweeks[0]}-${gameweeks.length}`}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width="100%"
          className="block"
          style={{ minWidth: `${width}px` }}
          role="img"
          aria-label={tr("리그 순위 추이 차트", "League rank trend chart")}
        >
          {Array.from({ length: maxRank }, (_, index) => {
            const y = getY(index + 1);
            return (
              <g key={`rank-${index + 1}`}>
                <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="var(--border)" strokeOpacity="0.55" />
                <text x={padding.left - 8} y={y + 4} fill="var(--muted)" fontSize="13" textAnchor="end">
                  {tr(`${index + 1}위`, `#${index + 1}`)}
                </text>
              </g>
            );
          })}
          {gameweeks.map((gw, index) => {
            const x = getX(index);
            return (
              <g key={`gw-${gw}`}>
                <line
                  x1={x}
                  y1={padding.top}
                  x2={x}
                  y2={height - padding.bottom}
                  stroke="var(--border)"
                  strokeOpacity="0.4"
                  strokeDasharray="4 8"
                />
                {(gameweeks.length - 1 - index) % gwLabelEvery === 0 ? (
                  <text x={x} y={height - 12} fill="var(--muted)" fontSize="13" textAnchor="middle">
                    GW{gw}
                  </text>
                ) : null}
              </g>
            );
          })}
          {activeIndex >= 0 ? (
            <rect
              x={getX(activeIndex) - 14}
              y={padding.top - 8}
              width="28"
              height={innerHeight + 16}
              rx="8"
              fill="var(--accent)"
              fillOpacity="0.08"
            />
          ) : null}
          {series.map(({ manager, points }) => {
            const path = points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`).join(" ");
            const last = points[points.length - 1];

            return (
              <g key={manager.entry}>
                <path
                  d={path}
                  fill="none"
                  stroke={manager.color}
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {points.map((point, index) => (
                  <circle key={`${manager.entry}-${index}`} cx={point.x} cy={point.y} r="2.6" fill={manager.color} />
                ))}
                <line
                  x1={last.x + 3}
                  y1={last.y}
                  x2={last.x + 8}
                  y2={labelY.get(manager.entry) ?? last.y}
                  stroke={manager.color}
                  strokeWidth="1"
                  strokeOpacity="0.6"
                />
                <text
                  x={last.x + 11}
                  y={(labelY.get(manager.entry) ?? last.y) + 3.5}
                  fill={manager.color}
                  fontSize="13"
                  fontWeight="700"
                >
                  {chartName(manager.playerName)}
                  {chartName(manager.playerName) !== manager.playerName ? <title>{manager.playerName}</title> : null}
                </text>
              </g>
            );
          })}
          {gameweeks.map((gw, index) => (
            <rect
              key={`hit-${gw}`}
              x={getX(index) - 14}
              y={padding.top - 8}
              width="28"
              height={innerHeight + 16}
              fill="transparent"
              className="cursor-pointer"
              onMouseEnter={() => setPickedGw(gw)}
              onClick={() => setPickedGw(gw)}
            >
              <title>GW{gw}</title>
            </rect>
          ))}
        </svg>
      </ChartScroll>

      <div className="mt-3 border-t border-[var(--border)] pt-3">
        <div className="mb-2 text-meta font-semibold">{tr(`GW${activeGw} 순위`, `GW${activeGw} ranks`)}</div>
        <ol className="grid grid-cols-2 gap-1.5 md:grid-cols-3 xl:grid-cols-4">
          {activeRows.map(({ manager, point }) => (
            <li
              key={manager.entry}
              className="flex min-w-0 items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-caption"
            >
              <span className="w-6 shrink-0 font-semibold tabular-nums">
                {tr(`${point.rank}위`, `#${point.rank}`)}
              </span>
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: manager.color }} />
              <span className="min-w-0 flex-1 truncate">{manager.playerName}</span>
              <span className="shrink-0 tabular-nums text-[var(--muted)]">
                {point.eventPoints}
                {tr("점", " pts")}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

const PERIODS = [
  { id: "5", ko: "최근 5", en: "Last 5", size: 5 },
  { id: "10", ko: "최근 10", en: "Last 10", size: 10 },
  { id: "all", ko: "전체", en: "All", size: null }
] as const;

type PeriodId = (typeof PERIODS)[number]["id"];

function PeriodTabs({ value, onChange }: { value: PeriodId; onChange: (value: PeriodId) => void }) {
  const { tr } = useLocale();
  return (
    <div role="group" aria-label={tr("표시 기간", "Period shown")} className="flex gap-1 rounded-md border border-[var(--border)] bg-[var(--bg)] p-0.5">
      {PERIODS.map((period) => (
        <button
          key={period.id}
          type="button"
          aria-pressed={value === period.id}
          onClick={() => onChange(period.id)}
          className={`rounded-md px-3 py-1 text-caption font-semibold transition ${
            value === period.id ? "bg-[var(--accent-soft)] text-[var(--accent-ink)] shadow-[inset_0_0_0_1px_var(--accent)]" : "text-[var(--muted)] hover:text-[var(--text)]"
          }`}
        >
          {tr(period.ko, period.en)}
        </button>
      ))}
    </div>
  );
}

/**
 * One row per manager, one column per gameweek, shaded by that week's score.
 * The shade is one blue ramp (never green against red) and the number is always printed.
 */
function GwHeatmap({ managers, gameweeks }: { managers: TrendManager[]; gameweeks: number[] }) {
  const { tr } = useLocale();
  const rows = [...managers].sort(
    (a, b) => (a.latestRank ?? Number.MAX_SAFE_INTEGER) - (b.latestRank ?? Number.MAX_SAFE_INTEGER)
  );
  const scores = rows.flatMap((manager) =>
    manager.full.filter((point): point is RankChangePoint => Boolean(point)).map((point) => point.eventPoints)
  );

  if (scores.length === 0) {
    return null;
  }

  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const shade = (value: number) => (max === min ? 0.5 : (value - min) / (max - min));

  return (
    <section className="rounded-md border border-[var(--border)] bg-[var(--surface)] p-3 md:p-4">
      <div className="mb-3">
        <div className="text-title font-semibold">{tr("GW별 점수 히트맵", "GW score heatmap")}</div>
        <div className="text-caption leading-5 text-[var(--muted)]">
          {tr("진할수록 고득점", "Darker = higher score")}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="border-separate border-spacing-[3px] text-caption">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-[var(--surface)]" />
              {gameweeks.map((gw) => (
                <th key={gw} className="px-0.5 text-center font-medium text-[var(--muted)]">
                  {gw}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((manager) => (
              <tr key={manager.entry}>
                <th
                  scope="row"
                  className="sticky left-0 z-10 max-w-[7rem] truncate bg-[var(--surface)] pr-2 text-left text-caption font-semibold"
                >
                  {manager.playerName}
                </th>
                {manager.full.map((point, index) => {
                  if (!point) {
                    return <td key={gameweeks[index]} className="h-8 min-w-8 rounded-md bg-[var(--chart-mute-soft)]/40" />;
                  }

                  const t = shade(point.eventPoints);

                  return (
                    <td
                      key={gameweeks[index]}
                      title={tr(`GW${gameweeks[index]} · ${point.eventPoints}점`, `GW${gameweeks[index]} · ${point.eventPoints} pts`)}
                      className="h-8 min-w-8 rounded-md text-center font-semibold tabular-nums"
                      style={{
                        backgroundColor: `color-mix(in srgb, var(--chart-in) ${Math.round(10 + t * 80)}%, white)`,
                        color: t > 0.55 ? "#fff" : "var(--text)"
                      }}
                    >
                      {point.eventPoints}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function StandingsSoFar({ managers, currentGw }: { managers: TrendManager[]; currentGw: number }) {
  const { tr } = useLocale();
  return (
    <section className="rounded-md border border-[var(--border)] bg-[var(--surface)] p-3 md:p-4">
      <div className="mb-3">
        <div className="text-title font-semibold">{tr(`GW${currentGw} 현재 순위`, `GW${currentGw} current ranks`)}</div>
        <div className="text-caption leading-5 text-[var(--muted)]">
          {tr("2주차부터 표시됩니다.", "Shows from GW 2.")}
        </div>
      </div>
      <ol className="grid gap-1.5">
        {managers.map((manager) => (
          <li
            key={manager.entry}
            className="grid grid-cols-[34px_minmax(0,1fr)_auto] items-center gap-3 rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2"
          >
            <span className="flex items-center gap-1.5 font-semibold tabular-nums">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: manager.color }} />
              {manager.latestRank ?? "-"}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-meta font-semibold">{manager.entryName}</span>
              <span className="block truncate text-caption text-[var(--muted)]">{manager.playerName}</span>
            </span>
            <span className="text-right text-meta tabular-nums">
              <span className="font-semibold">
                {manager.totalPoints}
                {tr("점", " pts")}
              </span>
              <span className="ml-2 text-caption text-[var(--muted)]">GW {manager.gwPoints}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function RankChangePanel({ data }: { data: RankChangeResponse }) {
  const { tr, locale } = useLocale();
  const trendManagers = useMemo(
    () => buildSeasonTrend(data.managers, data.trend.gameweeks),
    [data.managers, data.trend.gameweeks]
  );
  const [selectedEntries, setSelectedEntries] = useState<number[]>([]);
  const [showStats, setShowStats] = useState(false);
  const [period, setPeriod] = useState<PeriodId>("all");

  useEffect(() => {
    setSelectedEntries(data.managers.map((manager) => manager.entry));
  }, [data.managers]);

  // The period trims the chart and the heatmap alike so the two always show the same weeks.
  const periodSize = PERIODS.find((item) => item.id === period)?.size ?? null;
  const visibleGameweeks = useMemo(
    () => (periodSize ? data.trend.gameweeks.slice(-periodSize) : data.trend.gameweeks),
    [data.trend.gameweeks, periodSize]
  );
  const visibleManagers = useMemo(
    () =>
      periodSize
        ? trendManagers.map((manager) => ({ ...manager, full: manager.full.slice(-periodSize) }))
        : trendManagers,
    [periodSize, trendManagers]
  );

  const selectedManagers = useMemo(
    () => visibleManagers.filter((manager) => selectedEntries.includes(manager.entry)),
    [selectedEntries, visibleManagers]
  );

  const stats = useMemo(() => buildLeagueStats(trendManagers), [trendManagers]);
  const hasChart = data.trend.gameweeks.length >= MIN_GW_FOR_CHART;
  const statsReady = stats.trackedGameweeks >= MIN_GW_FOR_STATS;

  const summary = useMemo(() => {
    const leader =
      trendManagers.find((manager) => manager.latestRank === 1) ??
      [...trendManagers].sort((x, y) => y.totalPoints - x.totalPoints)[0];
    const scores = trendManagers.flatMap((manager) =>
      manager.trend.filter((row): row is RankChangePoint => Boolean(row)).map((row) => row.eventPoints)
    );

    return {
      leader,
      average: scores.length ? Math.round((scores.reduce((sum, value) => sum + value, 0) / scores.length) * 10) / 10 : 0
    };
  }, [trendManagers]);
  const topScore = stats.weeklyHighScoresTop[0];
  const topJump = stats.rankJumpTop[0];

  const selector = hasChart ? (
        <section className="rounded-md border border-[var(--border)] bg-[var(--surface)] p-3">
          <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="text-body-lg font-semibold">{tr("매니저 선택", "Select managers")}</div>
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-caption font-semibold transition hover:border-[var(--accent)]"
                onClick={() => setSelectedEntries(data.managers.map((manager) => manager.entry))}
              >
                {tr("전체 선택", "Select all")}
              </button>
              <button
                type="button"
                className="rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-caption font-semibold transition hover:border-[var(--accent)]"
                onClick={() => setSelectedEntries([])}
              >
                {tr("전체 해제", "Clear all")}
              </button>
            </div>
          </div>
          <div className="grid gap-1.5 md:grid-cols-2 lg:max-h-[48vh] lg:grid-cols-1 lg:overflow-y-auto">
            {trendManagers.map((manager) => {
              const active = selectedEntries.includes(manager.entry);

              return (
                <label
                  key={manager.entry}
                  className={`flex items-center gap-2 rounded-md border px-3 py-2 ${
                    active ? "border-[var(--accent)]/40 bg-[var(--accent-soft)]/50" : "border-[var(--border)] bg-[var(--bg)]"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={(event) => {
                      setSelectedEntries((current) =>
                        event.target.checked
                          ? Array.from(new Set([...current, manager.entry]))
                          : current.filter((value) => value !== manager.entry)
                      );
                    }}
                  />
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: manager.color }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-meta font-semibold">{manager.entryName}</span>
                    <span className="block truncate text-caption text-[var(--muted)]">{manager.playerName}</span>
                  </span>
                  <span className="shrink-0 text-right text-caption text-[var(--muted)]">
                    {manager.previousRank !== null && manager.latestRank !== null ? (
                      <RankDelta from={manager.previousRank} to={manager.latestRank} className="text-caption" />
                    ) : null}
                    {manager.seasonChange !== null ? (
                      <span className="ml-1.5" title={tr("첫 게임위크 대비", "Since the first gameweek")}>
                        {tr("시즌", "Season")} {manager.seasonChange > 0 ? "+" : ""}
                        {manager.seasonChange}
                      </span>
                    ) : null}
                  </span>
                </label>
              );
            })}
          </div>
        </section>
  ) : null;

  const sideContent = (
    <>
      {hasChart ? (
        <KpiGrid label={tr("순위 추이 요약", "Rank trend summary")}>
          <KpiCard
            label={tr("현재 1위", "Current leader")}
            value={summary.leader ? `${summary.leader.totalPoints}${tr("점", " pts")}` : "-"}
            sub={summary.leader?.playerName ?? ""}
          />
          <KpiCard
            label={tr("최고 GW 득점", "Best GW score")}
            value={topScore ? `${topScore.value}${tr("점", " pts")}` : "-"}
            sub={topScore ? `${topScore.playerName} · GW${topScore.gw}` : ""}
          />
          <KpiCard
            label={tr("최대 순위 상승", "Biggest climb")}
            value={topJump ? `+${topJump.value}` : "-"}
            sub={topJump ? `${topJump.playerName} · GW${topJump.gw}` : ""}
          />
          <KpiCard
            label={tr("GW 평균", "GW average")}
            value={`${summary.average}${tr("점", " pts")}`}
            sub={tr(`${stats.trackedGameweeks}개 GW 기준`, `${stats.trackedGameweeks} GWs`)}
          />
        </KpiGrid>
      ) : null}
      {selector}
    </>
  );

  return (
    <SidePanelLayout side={sideContent} sideFirst={false}>
    <section className="space-y-2">
      {!hasChart ? (
        <StandingsSoFar managers={trendManagers} currentGw={data.league.currentGw} />
      ) : selectedManagers.length ? (
        <TrendChart
          managers={selectedManagers}
          gameweeks={visibleGameweeks}
          totalManagers={trendManagers.length}
          headerRight={
            data.trend.gameweeks.length > PERIODS[0].size ? (
              <PeriodTabs value={period} onChange={setPeriod} />
            ) : undefined
          }
        />
      ) : (
        <section className="grid min-h-[220px] place-items-center rounded-md border border-[var(--border)] bg-[var(--surface)] p-4 text-center text-body text-[var(--muted)]">
          {tr("매니저를 하나 이상 선택해 주세요.", "Select at least one manager.")}
        </section>
      )}

      {hasChart ? <GwHeatmap managers={visibleManagers} gameweeks={visibleGameweeks} /> : null}

      <ChipStatusPanel managers={trendManagers} />

      <CollapsibleSection
        title={tr("시즌 기록", "Season records")}
        subtitle={tr("게임위크 수와 무관하게 시즌 누적으로 집계됩니다.", "Counted over the whole season, however many gameweeks have been played.")}
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <StatCard
            title={tr("벤치에 버린 점수", "Points left on the bench")}
            subtitle={tr("시즌 누적 벤치 점수 Top 5", "Top 5 season bench points")}
            items={stats.benchWasteTop}
            formatter={(item) => `${item.value}${tr("점", " pts")}`}
          />
          <StatCard
            title={tr("이적 히트 최다", "Most transfer hits")}
            subtitle={tr("시즌 누적 차감 점수 Top 5", "Top 5 season points deducted")}
            items={stats.hitCostTop}
            formatter={(item) => `−${item.value}${tr("점", " pts")}`}
          />
          <StatCard
            title={tr("팀 가치 최고", "Highest team value")}
            subtitle={tr("현재 스쿼드 가치 Top 5", "Top 5 current squad value")}
            items={stats.squadValueTop}
            formatter={(item) => formatMoney(item.value)}
          />
          <StatCard
            title={tr("전 세계 순위 최고", "Best global rank")}
            subtitle={tr("현재 FPL 전체 순위 Top 5", "Top 5 current overall FPL rank")}
            items={stats.overallRankTop}
            formatter={(item) => tr(`${item.value.toLocaleString("ko-KR")}위`, `#${item.value.toLocaleString("en-GB")}`)}
          />
          <StatCard
            title={tr("역대 최고 순위", "Best past finish")}
            subtitle={tr("지난 시즌들 중 최고 기록 Top 5", "Top 5 best result from past seasons")}
            items={stats.veteranBestTop}
            formatter={(item) => tr(`${item.value.toLocaleString("ko-KR")}위`, `#${item.value.toLocaleString("en-GB")}`)}
          />
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title={tr("GW 통계", "GW statistics")}
        subtitle={
          statsReady
            ? tr(`GW1~현재 ${stats.trackedGameweeks}주 기준`, `GW1 to now, ${stats.trackedGameweeks} weeks`)
            : tr(`${MIN_GW_FOR_STATS}주차부터 표시 (현재 ${stats.trackedGameweeks}주)`, `From GW ${MIN_GW_FOR_STATS} (now ${stats.trackedGameweeks})`)
        }
      >
        {!statsReady ? (
          <button
            type="button"
            onClick={() => setShowStats((current) => !current)}
            className="rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-caption font-semibold transition hover:border-[var(--accent)]"
          >
            {showStats ? tr("접기", "Hide") : tr("그래도 보기", "Show anyway")}
          </button>
        ) : null}

        {statsReady || showStats ? (
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <StatCard title={tr("개별 GW 1위 최다", "Most GW wins")} subtitle={tr("각 GW 종료 시점 1등 횟수 Top 5", "Top 5 times ranked 1st after a GW")} items={stats.firstPlaceTop} formatter={(item) => tr(`${item.value}회`, `${item.value}×`)} />
            <StatCard title={tr("개별 GW 2위 최다", "Most GW runner-ups")} subtitle={tr("각 GW 종료 시점 2등 횟수 Top 5", "Top 5 times ranked 2nd after a GW")} items={stats.secondPlaceTop} formatter={(item) => tr(`${item.value}회`, `${item.value}×`)} />
            <StatCard title={tr("포디움 최다", "Most podiums")} subtitle={tr("주차별 3위 이내 진입 횟수 Top 5", "Top 5 weeks spent in the top 3")} items={stats.podiumTop} formatter={(item) => tr(`${item.value}회`, `${item.value}×`)} />
            <StatCard title={tr("Top5 유지 최다", "Most weeks in the top 5")} subtitle={tr("주차별 5위 이내 유지 횟수 Top 5", "Top 5 weeks spent in the top 5")} items={stats.topFiveTop} formatter={(item) => tr(`${item.value}회`, `${item.value}×`)} />
            <StatCard title={tr("누적점수 최고", "Highest total")} subtitle={tr("현재 누적점수 Top 5", "Top 5 current total points")} items={stats.bestTotalPointsTop} formatter={(item) => `${item.value}${tr("점", " pts")}`} />
            <StatCard title={tr("개별 GW 최고득점", "Best single GW")} subtitle={tr("단일 GW 득점 기록 Top 5", "Top 5 single-GW scores")} items={stats.weeklyHighScoresTop} formatter={(item) => `GW${item.gw} · ${item.value}${tr("점", " pts")}`} />
            <StatCard title={tr("주간 평균점수", "Weekly average")} subtitle={tr("GW 평균 득점 Top 5", "Top 5 average GW score")} items={stats.averageEventPointsTop} formatter={(item) => `${item.value}${tr("점", " pts")}`} />
            <StatCard title={tr("평균 순위 최고", "Best average rank")} subtitle={tr("시즌 평균 리그 순위 Top 5", "Top 5 season-average league rank")} items={stats.averageRankTop} formatter={(item) => tr(`${item.value}위`, `#${item.value}`)} />
            <StatCard title={tr("최대 순위 점프", "Biggest rank jump")} subtitle={tr("직전 GW 대비 상승폭 Top 5", "Top 5 climbs versus the previous GW")} items={stats.rankJumpTop} formatter={(item) => `GW${item.gw} · +${item.value}`} />
          </div>
        ) : null}
      </CollapsibleSection>
    </section>
    </SidePanelLayout>
  );
}
