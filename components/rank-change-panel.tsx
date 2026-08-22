"use client";

import { useEffect, useMemo, useState } from "react";
import { RankDelta } from "@/components/rank-delta";
import type { RankChangeManager, RankChangePoint, RankChangeResponse } from "@/lib/types";

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

  return {
    trackedGameweeks: Math.max(
      ...managers.map((manager) => manager.trend.filter(Boolean).length),
      0
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
  return (
    <article className="rounded-[1.1rem] border border-[var(--border)] bg-white/90 p-3 shadow-[0_8px_24px_rgba(55,40,20,0.05)]">
      <div className="text-[15px] font-semibold">{title}</div>
      <div className="mt-1 text-[12px] text-[var(--muted)]">{subtitle}</div>
      <div className="mt-3 grid gap-2">
        {items.length ? (
          items.map((item, index) => (
            <div
              key={`${item.entry}-${index}`}
              className="grid grid-cols-[26px_minmax(0,1fr)_auto] items-center gap-2 border-t border-stone-100 pt-2 first:border-t-0 first:pt-0"
            >
              <div className="grid h-[26px] w-[26px] place-items-center rounded-full bg-[var(--accent)]/10 text-[11px] font-semibold text-[var(--accent)]">
                {index + 1}
              </div>
              <div className="min-w-0">
                <div className="truncate text-[13px] font-semibold">{item.entryName}</div>
                <div className="truncate text-[11px] text-[var(--muted)]">{item.playerName}</div>
              </div>
              <div className="text-right text-[12px] font-semibold text-[var(--accent)]">{formatter(item)}</div>
            </div>
          ))
        ) : (
          <div className="text-[12px] text-[var(--muted)]">데이터가 없습니다.</div>
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
function spreadLabels(entries: Array<{ key: number; y: number }>, minGap: number) {
  const sorted = [...entries].sort((left, right) => left.y - right.y);
  const placed = new Map<number, number>();
  let previous = Number.NEGATIVE_INFINITY;

  for (const entry of sorted) {
    const y = Math.max(entry.y, previous + minGap);
    placed.set(entry.key, y);
    previous = y;
  }

  return placed;
}

function TrendChart({
  managers,
  gameweeks,
  totalManagers
}: {
  managers: TrendManager[];
  gameweeks: number[];
  totalManagers: number;
}) {
  const width = Math.max(760, 150 + gameweeks.length * 32);
  const height = Math.max(300, 120 + totalManagers * 20);
  const padding = { top: 24, right: 132, bottom: 42, left: 48 };
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

  const labelY = spreadLabels(
    series.map((item) => ({ key: item.manager.entry, y: item.points[item.points.length - 1].y })),
    12
  );

  return (
    <section className="rounded-[1.2rem] border border-[var(--border)] bg-[var(--surface)] p-3 shadow-[0_12px_36px_rgba(55,40,20,0.07)] md:p-4">
      <div className="mb-3">
        <div className="text-[1.05rem] font-semibold">개인별 순위 변화</div>
        <div className="text-[12px] leading-5 text-[var(--muted)]">
          GW1부터 현재 GW까지 누적점수 기준 리그 등수입니다.
        </div>
      </div>
      <div className="overflow-x-auto pb-1">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width="100%"
          className="block"
          style={{ minWidth: `${Math.min(width, 640)}px` }}
          role="img"
          aria-label="리그 순위 추이 차트"
        >
          {Array.from({ length: maxRank }, (_, index) => {
            const y = getY(index + 1);
            return (
              <g key={`rank-${index + 1}`}>
                <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="var(--border)" strokeOpacity="0.55" />
                <text x={padding.left - 8} y={y + 4} fill="var(--muted)" fontSize="10" textAnchor="end">
                  {index + 1}위
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
                <text x={x} y={height - 12} fill="var(--muted)" fontSize="10" textAnchor="middle">
                  GW{gw}
                </text>
              </g>
            );
          })}
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
                  fontSize="10"
                  fontWeight="700"
                >
                  {manager.playerName}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </section>
  );
}

function StandingsSoFar({ managers, currentGw }: { managers: TrendManager[]; currentGw: number }) {
  return (
    <section className="rounded-[1.2rem] border border-[var(--border)] bg-[var(--surface)] p-3 shadow-[0_12px_36px_rgba(55,40,20,0.07)] md:p-4">
      <div className="mb-3">
        <div className="text-[1.05rem] font-semibold">GW{currentGw} 현재 순위</div>
        <div className="text-[12px] leading-5 text-[var(--muted)]">
          게임위크가 2주차에 접어들면 순위 변화 차트가 여기에 표시됩니다.
        </div>
      </div>
      <ol className="grid gap-1.5">
        {managers.map((manager) => (
          <li
            key={manager.entry}
            className="grid grid-cols-[34px_minmax(0,1fr)_auto] items-center gap-3 rounded-[0.9rem] border border-[var(--border)] bg-white px-3 py-2"
          >
            <span className="flex items-center gap-1.5 font-semibold tabular-nums">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: manager.color }} />
              {manager.latestRank ?? "-"}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-semibold">{manager.entryName}</span>
              <span className="block truncate text-[11px] text-[var(--muted)]">{manager.playerName}</span>
            </span>
            <span className="text-right text-[13px] tabular-nums">
              <span className="font-semibold">{manager.totalPoints}점</span>
              <span className="ml-2 text-[11px] text-[var(--muted)]">GW {manager.gwPoints}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function RankChangePanel({ data }: { data: RankChangeResponse }) {
  const trendManagers = useMemo(
    () => buildSeasonTrend(data.managers, data.trend.gameweeks),
    [data.managers, data.trend.gameweeks]
  );
  const [selectedEntries, setSelectedEntries] = useState<number[]>([]);
  const [showStats, setShowStats] = useState(false);

  useEffect(() => {
    setSelectedEntries(data.managers.map((manager) => manager.entry));
  }, [data.managers]);

  const selectedManagers = useMemo(
    () => trendManagers.filter((manager) => selectedEntries.includes(manager.entry)),
    [selectedEntries, trendManagers]
  );

  const stats = useMemo(() => buildLeagueStats(trendManagers), [trendManagers]);
  const hasChart = data.trend.gameweeks.length >= MIN_GW_FOR_CHART;
  const statsReady = stats.trackedGameweeks >= MIN_GW_FOR_STATS;

  return (
    <section className="space-y-4">
      {!hasChart ? (
        <StandingsSoFar managers={trendManagers} currentGw={data.league.currentGw} />
      ) : selectedManagers.length ? (
        <TrendChart
          managers={selectedManagers}
          gameweeks={data.trend.gameweeks}
          totalManagers={trendManagers.length}
        />
      ) : (
        <section className="grid min-h-[220px] place-items-center rounded-[1.2rem] border border-[var(--border)] bg-[var(--surface)] p-4 text-center text-[14px] text-[var(--muted)]">
          매니저를 하나 이상 선택해 주세요.
        </section>
      )}

      {hasChart ? (
        <section className="rounded-[1.2rem] border border-[var(--border)] bg-[var(--surface)] p-3 shadow-[0_12px_36px_rgba(55,40,20,0.07)]">
          <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="text-[1rem] font-semibold">매니저 선택</div>
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-[12px] font-semibold transition hover:border-[var(--accent)]"
                onClick={() => setSelectedEntries(data.managers.map((manager) => manager.entry))}
              >
                전체 선택
              </button>
              <button
                type="button"
                className="rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-[12px] font-semibold transition hover:border-[var(--accent)]"
                onClick={() => setSelectedEntries([])}
              >
                전체 해제
              </button>
            </div>
          </div>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {trendManagers.map((manager) => {
              const active = selectedEntries.includes(manager.entry);

              return (
                <label
                  key={manager.entry}
                  className={`flex items-center gap-2 rounded-[0.9rem] border px-3 py-2 ${
                    active ? "border-[var(--accent)]/40 bg-[var(--accent-soft)]/50" : "border-[var(--border)] bg-white"
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
                    <span className="block truncate text-[13px] font-semibold">{manager.entryName}</span>
                    <span className="block truncate text-[11px] text-[var(--muted)]">{manager.playerName}</span>
                  </span>
                  <span className="shrink-0 text-right text-[11px] text-[var(--muted)]">
                    {manager.previousRank !== null && manager.latestRank !== null ? (
                      <RankDelta from={manager.previousRank} to={manager.latestRank} className="text-[12px]" />
                    ) : null}
                    {manager.seasonChange !== null ? (
                      <span className="ml-1.5" title="첫 게임위크 대비">
                        시즌 {manager.seasonChange > 0 ? "+" : ""}
                        {manager.seasonChange}
                      </span>
                    ) : null}
                  </span>
                </label>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="rounded-[1.2rem] border border-[var(--border)] bg-[var(--surface)] p-3 shadow-[0_12px_36px_rgba(55,40,20,0.07)]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-[1rem] font-semibold">GW 통계</div>
            <div className="text-[12px] text-[var(--muted)]">
              {statsReady
                ? `GW1부터 현재까지 ${stats.trackedGameweeks}개 게임위크 기준입니다.`
                : `게임위크 ${MIN_GW_FOR_STATS}주차부터 의미 있는 값이 나옵니다. 현재 ${stats.trackedGameweeks}주차.`}
            </div>
          </div>
          {!statsReady ? (
            <button
              type="button"
              onClick={() => setShowStats((current) => !current)}
              className="rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-[12px] font-semibold transition hover:border-[var(--accent)]"
            >
              {showStats ? "접기" : "그래도 보기"}
            </button>
          ) : null}
        </div>

        {statsReady || showStats ? (
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <StatCard title="개별 GW 1위 최다" subtitle="각 GW 종료 시점 1등 횟수 Top 5" items={stats.firstPlaceTop} formatter={(item) => `${item.value}회`} />
            <StatCard title="개별 GW 2위 최다" subtitle="각 GW 종료 시점 2등 횟수 Top 5" items={stats.secondPlaceTop} formatter={(item) => `${item.value}회`} />
            <StatCard title="포디움 최다" subtitle="주차별 3위 이내 진입 횟수 Top 5" items={stats.podiumTop} formatter={(item) => `${item.value}회`} />
            <StatCard title="Top5 유지 최다" subtitle="주차별 5위 이내 유지 횟수 Top 5" items={stats.topFiveTop} formatter={(item) => `${item.value}회`} />
            <StatCard title="누적점수 최고" subtitle="현재 누적점수 Top 5" items={stats.bestTotalPointsTop} formatter={(item) => `${item.value}점`} />
            <StatCard title="개별 GW 최고득점" subtitle="단일 GW 득점 기록 Top 5" items={stats.weeklyHighScoresTop} formatter={(item) => `GW${item.gw} · ${item.value}점`} />
            <StatCard title="주간 평균점수" subtitle="GW 평균 득점 Top 5" items={stats.averageEventPointsTop} formatter={(item) => `${item.value}점`} />
            <StatCard title="평균 순위 최고" subtitle="시즌 평균 리그 순위 Top 5" items={stats.averageRankTop} formatter={(item) => `${item.value}위`} />
            <StatCard title="최대 순위 점프" subtitle="직전 GW 대비 상승폭 Top 5" items={stats.rankJumpTop} formatter={(item) => `GW${item.gw} · +${item.value}`} />
          </div>
        ) : null}
      </section>
    </section>
  );
}
