"use client";

import { useEffect, useMemo, useState } from "react";
import type { RankChangeManager, RankChangePoint, RankChangeResponse } from "@/lib/types";

const RECENT_TREND_COUNT = 8;
const STAT_LIMIT = 5;

type TrendManager = {
  entry: number;
  entryName: string;
  playerName: string;
  latestRank: number | null;
  gwPoints: number;
  totalPoints: number;
  color: string;
  seasonChange: number | null;
  recentChange: number | null;
  full: Array<RankChangePoint | null>;
  trend: Array<RankChangePoint | null>;
};

type StatItem = {
  entry: number;
  entryName: string;
  playerName: string;
  value: number;
  gw?: number;
};

function buildSeasonTrend(managers: RankChangeManager[], gameweeks: number[]) {
  const recentGameweeks = gameweeks.slice(-RECENT_TREND_COUNT);

  return {
    gameweeks,
    managers: managers.map((manager) => {
      const trend = Array.isArray(manager.trend) ? manager.trend.filter(Boolean) : [];
      const byGw = new Map((trend as RankChangePoint[]).map((row) => [row.gw, row]));
      const full = gameweeks.map((gw) => byGw.get(gw) || null);
      const firstRank = (trend as RankChangePoint[])[0]?.rank ?? null;
      const latestRank = (trend as RankChangePoint[])[(trend as RankChangePoint[]).length - 1]?.rank ?? null;
      const recentRows = recentGameweeks.map((gw) => byGw.get(gw) || null).filter(Boolean) as RankChangePoint[];
      const firstRecentRank = recentRows[0]?.rank ?? null;
      const latestRecentRank = recentRows[recentRows.length - 1]?.rank ?? null;

      return {
        entry: manager.entry,
        entryName: manager.entryName,
        playerName: manager.playerName,
        latestRank: manager.latestRank,
        gwPoints: manager.gwPoints,
        totalPoints: manager.totalPoints,
        color: manager.color,
        seasonChange: Number.isFinite(firstRank) && Number.isFinite(latestRank) ? firstRank - latestRank : null,
        recentChange:
          Number.isFinite(firstRecentRank) && Number.isFinite(latestRecentRank)
            ? firstRecentRank - latestRecentRank
            : null,
        full,
        trend: manager.trend
      } satisfies TrendManager;
    })
  };
}

function buildLeagueStats(managers: TrendManager[]) {
  const firstPlaceCounts = new Map<number, number>();
  const secondPlaceCounts = new Map<number, number>();
  const cumulativeLeaderCounts = new Map<number, number>();
  const weeklyHighScores: StatItem[] = [];
  const weeklyRankJumps: StatItem[] = [];
  const averageEventScores: StatItem[] = [];
  const podiumCounts = new Map<number, number>();
  const consistentTopFiveCounts = new Map<number, number>();
  const bestTotalPoints: StatItem[] = [];
  const lowestAverageRank: StatItem[] = [];

  managers.forEach((manager) => {
    const validTrend = manager.trend.filter(Boolean) as RankChangePoint[];
    let podium = 0;
    let topFive = 0;

    averageEventScores.push({
      entry: manager.entry,
      entryName: manager.entryName,
      playerName: manager.playerName,
      value: Number(
        (validTrend.reduce((sum, row) => sum + row.eventPoints, 0) / Math.max(validTrend.length, 1)).toFixed(1)
      )
    });

    lowestAverageRank.push({
      entry: manager.entry,
      entryName: manager.entryName,
      playerName: manager.playerName,
      value: Number((validTrend.reduce((sum, row) => sum + row.rank, 0) / Math.max(validTrend.length, 1)).toFixed(2))
    });

    bestTotalPoints.push({
      entry: manager.entry,
      entryName: manager.entryName,
      playerName: manager.playerName,
      value: manager.totalPoints
    });

    validTrend.forEach((row, index) => {
      if (row.rank === 1) {
        cumulativeLeaderCounts.set(manager.entry, (cumulativeLeaderCounts.get(manager.entry) || 0) + 1);
        firstPlaceCounts.set(manager.entry, (firstPlaceCounts.get(manager.entry) || 0) + 1);
      }
      if (row.rank === 2) {
        secondPlaceCounts.set(manager.entry, (secondPlaceCounts.get(manager.entry) || 0) + 1);
      }
      if (row.rank <= 3) podium += 1;
      if (row.rank <= 5) topFive += 1;

      weeklyHighScores.push({
        entry: manager.entry,
        entryName: manager.entryName,
        playerName: manager.playerName,
        gw: row.gw,
        value: row.eventPoints
      });

      if (index > 0) {
        const previous = validTrend[index - 1];
        weeklyRankJumps.push({
          entry: manager.entry,
          entryName: manager.entryName,
          playerName: manager.playerName,
          gw: row.gw,
          value: previous.rank - row.rank
        });
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
    trackedGameweeks: Math.max(...managers.map((manager) => manager.trend.filter(Boolean).length), 0),
    firstPlaceTop: mapCountRanking(firstPlaceCounts),
    secondPlaceTop: mapCountRanking(secondPlaceCounts),
    cumulativeLeaderTop: mapCountRanking(cumulativeLeaderCounts),
    podiumTop: mapCountRanking(podiumCounts),
    topFiveTop: mapCountRanking(consistentTopFiveCounts),
    weeklyHighScoresTop: weeklyHighScores.sort((a, b) => b.value - a.value || (a.gw || 0) - (b.gw || 0)).slice(0, STAT_LIMIT),
    averageEventPointsTop: averageEventScores.sort((a, b) => b.value - a.value).slice(0, STAT_LIMIT),
    averageRankTop: lowestAverageRank.sort((a, b) => a.value - b.value).slice(0, STAT_LIMIT),
    bestTotalPointsTop: bestTotalPoints.sort((a, b) => b.value - a.value).slice(0, STAT_LIMIT),
    rankJumpTop: weeklyRankJumps.filter((item) => item.value > 0).sort((a, b) => b.value - a.value || (a.gw || 0) - (b.gw || 0)).slice(0, STAT_LIMIT)
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
            <div key={`${item.entry}-${index}`} className="grid grid-cols-[26px_minmax(0,1fr)_auto] items-center gap-2 border-t border-stone-100 pt-2 first:border-t-0 first:pt-0">
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

function TrendChart({ managers, gameweeks, totalManagers }: { managers: TrendManager[]; gameweeks: number[]; totalManagers: number }) {
  const width = Math.max(980, 140 + gameweeks.length * 30);
  const height = Math.max(420, 140 + totalManagers * 18);
  const padding = { top: 24, right: 120, bottom: 42, left: 48 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const maxRank = Math.max(totalManagers, 1);
  const stepX = gameweeks.length > 1 ? innerWidth / (gameweeks.length - 1) : 0;
  const getX = (index: number) => padding.left + stepX * index;
  const getY = (rank: number) => padding.top + ((rank - 1) / Math.max(maxRank - 1, 1)) * innerHeight;

  return (
    <section className="rounded-[1.2rem] bg-[#171c23] p-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]">
      <div className="mb-3">
        <div className="text-[1.3rem] font-semibold text-[#f5f7fa]">개인별 순위 변화</div>
        <div className="text-[12px] leading-5 text-[rgba(206,212,218,0.74)]">
          GW1부터 현재 GW까지 누적점수 기준 리그 등수 변화입니다.
        </div>
      </div>
      <div className="overflow-x-auto px-1 pb-1">
        <svg viewBox={`0 0 ${width} ${height}`} width="100%" className="block min-w-[920px]" aria-label="league-rank-trend-chart">
          {Array.from({ length: maxRank }, (_, index) => {
            const y = getY(index + 1);
            return (
              <g key={`rank-${index + 1}`}>
                <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="rgba(255,255,255,0.08)" />
                <text x={padding.left - 8} y={y + 4} fill="rgba(206,212,218,0.68)" fontSize="10" textAnchor="end">
                  #{index + 1}
                </text>
              </g>
            );
          })}
          {gameweeks.map((gw, index) => {
            const x = getX(index);
            return (
              <g key={`gw-${gw}`}>
                <line x1={x} y1={padding.top} x2={x} y2={height - padding.bottom} stroke="rgba(255,255,255,0.05)" strokeDasharray="4 8" />
                <text x={x} y={height - 12} fill="rgba(206,212,218,0.76)" fontSize="10" textAnchor="middle">
                  {gw}
                </text>
              </g>
            );
          })}
          {managers.map((manager) => {
            const points = manager.full
              .map((row, index) => (row ? { x: getX(index), y: getY(row.rank) } : null))
              .filter(Boolean) as Array<{ x: number; y: number }>;

            if (!points.length) {
              return null;
            }

            const path = points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`).join(" ");
            const last = points[points.length - 1];

            return (
              <g key={manager.entry}>
                <path d={path} fill="none" stroke={manager.color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                {points.map((point, index) => (
                  <circle key={`${manager.entry}-${index}`} cx={point.x} cy={point.y} r="2.6" fill={manager.color} />
                ))}
                <text x={last.x + 6} y={last.y + 4} fill={manager.color} fontSize="10" fontWeight="700">
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

export function RankChangePanel({ data }: { data: RankChangeResponse }) {
  const trend = useMemo(() => buildSeasonTrend(data.managers, data.trend.gameweeks), [data.managers, data.trend.gameweeks]);
  const [selectedEntries, setSelectedEntries] = useState<number[]>([]);

  useEffect(() => {
    setSelectedEntries(data.managers.map((manager) => manager.entry));
  }, [data.managers]);

  const selectedManagers = useMemo(
    () => trend.managers.filter((manager) => selectedEntries.includes(manager.entry)),
    [selectedEntries, trend.managers]
  );

  const stats = useMemo(() => buildLeagueStats(trend.managers), [trend.managers]);

  return (
    <section className="space-y-4">
      {selectedManagers.length ? (
        <TrendChart managers={selectedManagers} gameweeks={trend.gameweeks} totalManagers={trend.managers.length} />
      ) : (
        <section className="grid min-h-[280px] place-items-center rounded-[1.2rem] border border-[var(--border)] bg-[#171c23] p-4 text-center text-[14px] text-[rgba(206,212,218,0.82)]">
          매니저를 하나 이상 선택해 주세요.
        </section>
      )}

      <section className="rounded-[1.2rem] border border-[var(--border)] bg-[var(--surface)] p-3 shadow-[0_12px_36px_rgba(55,40,20,0.07)]">
        <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-[1rem] font-semibold">매니저 선택</div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-[12px] font-semibold"
              onClick={() => setSelectedEntries(data.managers.map((manager) => manager.entry))}
            >
              전체 선택
            </button>
            <button
              type="button"
              className="rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-[12px] font-semibold"
              onClick={() => setSelectedEntries([])}
            >
              전체 해제
            </button>
          </div>
        </div>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {trend.managers.map((manager) => {
            const active = selectedEntries.includes(manager.entry);
            return (
              <label
                key={manager.entry}
                className={`flex items-center gap-2 rounded-[0.9rem] border px-3 py-2 ${active ? "border-[var(--accent)]/40 bg-[#fff8ee]" : "border-[var(--border)] bg-white"}`}
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
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: manager.color }} />
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-semibold">{manager.entryName}</span>
                  <span className="block truncate text-[11px] text-[var(--muted)]">{manager.playerName}</span>
                </span>
              </label>
            );
          })}
        </div>
      </section>

      <section className="rounded-[1.2rem] border border-[var(--border)] bg-[var(--surface)] p-3 shadow-[0_12px_36px_rgba(55,40,20,0.07)]">
        <div className="mb-3">
          <div className="text-[1rem] font-semibold">GW 통계</div>
          <div className="text-[12px] text-[var(--muted)]">GW1부터 현재까지 {stats.trackedGameweeks}개 게임위크를 기준으로 계산했습니다.</div>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <StatCard title="개별 GW 1위 최다" subtitle="각 GW 종료 시점 1등 횟수 Top 5" items={stats.firstPlaceTop} formatter={(item) => `${item.value}회`} />
          <StatCard title="개별 GW 2위 최다" subtitle="각 GW 종료 시점 2등 횟수 Top 5" items={stats.secondPlaceTop} formatter={(item) => `${item.value}회`} />
          <StatCard title="누적 1위 유지 최다" subtitle="누적점수 기준 주차별 1위 횟수 Top 5" items={stats.cumulativeLeaderTop} formatter={(item) => `${item.value}회`} />
          <StatCard title="포디움 최다" subtitle="주차별 3위 이내 진입 횟수 Top 5" items={stats.podiumTop} formatter={(item) => `${item.value}회`} />
          <StatCard title="Top5 유지 최다" subtitle="주차별 5위 이내 유지 횟수 Top 5" items={stats.topFiveTop} formatter={(item) => `${item.value}회`} />
          <StatCard title="누적점수 최고" subtitle="현재 누적점수 Top 5" items={stats.bestTotalPointsTop} formatter={(item) => `${item.value}점`} />
          <StatCard title="개별 GW 최고득점" subtitle="단일 GW 득점 기록 Top 5" items={stats.weeklyHighScoresTop} formatter={(item) => `GW${item.gw} · ${item.value}점`} />
          <StatCard title="주간 평균점수" subtitle="GW 평균 득점 Top 5" items={stats.averageEventPointsTop} formatter={(item) => `${item.value}점`} />
          <StatCard title="평균 순위 최고" subtitle="시즌 평균 리그 순위 Top 5" items={stats.averageRankTop} formatter={(item) => `${item.value}위`} />
          <StatCard title="최대 순위 점프" subtitle="직전 GW 대비 상승폭 Top 5" items={stats.rankJumpTop} formatter={(item) => `GW${item.gw} · +${item.value}`} />
        </div>
      </section>
    </section>
  );
}
