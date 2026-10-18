"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import type { LeagueLiveResponse, PlayerStatsResponse, RankChangeResponse } from "@/lib/types";
import { CaptainStats } from "@/components/captain-stats";
import { DeadlineBanner } from "@/components/deadline-banner";
import { FixturesPanel } from "@/components/fixtures-panel";
import { LeagueKpis } from "@/components/league-kpis";
import { LeagueTable } from "@/components/league-table";
import { PlayerTrendsPanel } from "@/components/player-trends-panel";
import { RankChangePanel } from "@/components/rank-change-panel";
import { SidePanelLayout } from "@/components/side-panel-layout";
import { RefreshIndicator } from "@/components/refresh-indicator";

async function fetchLeagueLive(leagueId: string, refresh = false) {
  const response = await fetch(
    `/api/league-live?leagueId=${leagueId}&gw=current${refresh ? "&refresh=1" : ""}`
  );

  if (!response.ok) {
    const payload = (await response.json()) as { error?: string };
    throw new Error(payload.error ?? "리그 데이터를 불러오지 못했습니다.");
  }

  return (await response.json()) as LeagueLiveResponse;
}

async function fetchRankChange(leagueId: string) {
  const response = await fetch(`/api/league-rank-change?leagueId=${leagueId}`);

  if (!response.ok) {
    const payload = (await response.json()) as { error?: string };
    throw new Error(payload.error ?? "순위 추이 데이터를 불러오지 못했습니다.");
  }

  return (await response.json()) as RankChangeResponse;
}

async function fetchPlayerStats(leagueId: string) {
  const response = await fetch(`/api/player-stats?leagueId=${leagueId}&gw=current`);

  if (!response.ok) {
    const payload = (await response.json()) as { error?: string };
    throw new Error(payload.error ?? "선수 데이터를 불러오지 못했습니다.");
  }

  return (await response.json()) as PlayerStatsResponse;
}

type Tab = "standings" | "fixtures" | "rank-change" | "player-trends";

export function LeagueDashboard({ leagueId, buildId }: { leagueId: string; buildId: string }) {
  const [tab, setTab] = useState<Tab>("standings");
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["league-live", leagueId],
    queryFn: () => fetchLeagueLive(leagueId),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: true
  });

  const rankChangeQuery = useQuery({
    queryKey: ["league-rank-change", leagueId],
    queryFn: () => fetchRankChange(leagueId),
    enabled: tab === "rank-change",
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false
  });

  const playerStatsQuery = useQuery({
    queryKey: ["player-stats", leagueId],
    queryFn: () => fetchPlayerStats(leagueId),
    enabled: tab === "player-trends",
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false
  });

  const tabs = useMemo(
    () => [
      { id: "standings", label: "주간 순위" },
      { id: "fixtures", label: "경기 일정" },
      { id: "rank-change", label: "순위 추이" },
      { id: "player-trends", label: "선수 추이" }
    ] as const,
    []
  );

  // Force-refresh bypasses the server's 30s memo so the button means something.
  async function handleRefresh() {
    const fresh = await fetchLeagueLive(leagueId, true);
    queryClient.setQueryData(["league-live", leagueId], fresh);
    if (tab === "rank-change") {
      await rankChangeQuery.refetch();
    }
    if (tab === "player-trends") {
      await playerStatsQuery.refetch();
    }
  }

  const isRankChangeTab = tab === "rank-change";
  const isPlayerTab = tab === "player-trends";
  const activeError = isRankChangeTab
    ? rankChangeQuery.error
    : isPlayerTab
      ? playerStatsQuery.error
      : query.error;
  const isLoading = isRankChangeTab
    ? rankChangeQuery.isLoading
    : isPlayerTab
      ? playerStatsQuery.isLoading
      : query.isLoading;

  return (
    <main className="mx-auto flex min-h-screen max-w-[1440px] flex-col px-1.5 py-1.5 sm:px-2 md:px-3 md:py-2">
      <div className="mb-2 flex flex-col gap-2 md:mb-3 md:flex-row md:items-end md:justify-between md:gap-3">
        <div className="min-w-0">
          <Link
            href="/"
            className="text-[11px] uppercase tracking-[0.18em] text-[var(--muted)] transition hover:text-[var(--accent)] md:text-xs"
          >
            다른 리그 검색
          </Link>
          <h1 className="mt-1 text-2xl font-semibold leading-none md:text-3xl">
            {query.data?.league.name ??
              rankChangeQuery.data?.league.name ??
              playerStatsQuery.data?.league.name ??
              `리그 ${leagueId}`}
          </h1>
          <p className="text-sm text-[var(--muted)]">
            {query.data
              ? `게임위크 ${query.data.league.currentGw} 라이브 대시보드`
              : rankChangeQuery.data
                ? `게임위크 ${rankChangeQuery.data.league.currentGw} 순위 기록`
                : playerStatsQuery.data
                  ? `게임위크 ${playerStatsQuery.data.league.currentGw} 선수 데이터`
                  : "공식 FPL 데이터를 불러오는 중"}
          </p>
        </div>

        {query.data ? (
          <RefreshIndicator
            lastUpdated={query.data.league.lastUpdated}
            isFetching={query.isFetching || rankChangeQuery.isFetching || playerStatsQuery.isFetching}
            isProvisional={query.data.league.isProvisional}
            onRefresh={handleRefresh}
          />
        ) : null}
      </div>

      {isLoading ? (
        <div className="grid gap-3">
          {Array.from({ length: isRankChangeTab ? 6 : 8 }).map((_, index) => (
            <div
              key={index}
              className={`animate-pulse rounded-2xl border border-[var(--border)] bg-[var(--surface)]/80 ${
                isRankChangeTab ? "h-24" : "h-16"
              }`}
            />
          ))}
        </div>
      ) : null}

      {activeError ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-[var(--danger)]">
          {(activeError as Error).message}
        </div>
      ) : null}

      {query.data && query.data.rows.length === 0 ? (
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6">
          이 리그의 순위 데이터가 비어 있습니다. 공개 클래식 리그 ID인지 확인해 주세요.
        </div>
      ) : null}

      {query.data || rankChangeQuery.data || playerStatsQuery.data ? (
        <>
          {query.data && query.data.errors.length > 0 && !isRankChangeTab && !isPlayerTab ? (
            <div className="mb-4 rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-[var(--warning)]">
              매니저 {query.data.errors.length}명의 데이터를 불러오지 못했습니다. 킥오프 후 자동 반영됩니다.
            </div>
          ) : null}

          {query.data?.league.nextDeadline ? (
            <DeadlineBanner
              gw={query.data.league.nextDeadline.gw}
              deadlineTime={query.data.league.nextDeadline.deadlineTime}
            />
          ) : null}

          <div
            role="tablist"
            aria-label="대시보드 보기"
            className="mb-2 flex w-full gap-1 overflow-x-auto rounded-[1rem] border border-[var(--border)] bg-[var(--surface)] p-1 md:w-auto"
          >
            {tabs.map((item) => {
              const active = tab === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(item.id)}
                  className={`flex-1 whitespace-nowrap rounded-[0.8rem] px-3 py-1.5 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] md:flex-none md:px-4 ${
                    active ? "bg-[var(--text)] text-white" : "text-[var(--muted)] hover:text-[var(--text)]"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          {tab === "standings" && query.data ? (
            <>
              <SidePanelLayout
                side={
                  <>
                    <LeagueKpis rows={query.data.rows} gw={query.data.league.currentGw} />
                    <CaptainStats stats={query.data.captainStats} layout="list" />
                  </>
                }
              >
                <LeagueTable data={query.data} />
              </SidePanelLayout>
            </>
          ) : null}

          {tab === "fixtures" && query.data ? (
            <FixturesPanel
              fixtures={query.data.fixtures}
              currentGw={query.data.league.currentGw}
              rows={query.data.rows}
            />
          ) : null}

          {tab === "rank-change" && rankChangeQuery.data ? (
            <RankChangePanel data={rankChangeQuery.data} />
          ) : null}

          {tab === "player-trends" && playerStatsQuery.data ? (
            <PlayerTrendsPanel data={playerStatsQuery.data} />
          ) : null}
        </>
      ) : null}

      <footer className="mt-auto pt-8 text-center text-[11px] text-[var(--muted)] opacity-70" title="배포 버전">
        build {buildId}
      </footer>
    </main>
  );
}
