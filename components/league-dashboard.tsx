"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import type { LeagueLiveResponse, PlayerStatsResponse, RankChangeResponse } from "@/lib/types";
import { CaptainStats } from "@/components/captain-stats";
import { DeadlineBanner } from "@/components/deadline-banner";
import { FixturesPanel } from "@/components/fixtures-panel";
import { LocaleToggle, useLocale } from "@/components/locale-provider";
import { LeagueKpis } from "@/components/league-kpis";
import { LeagueTable } from "@/components/league-table";
import { PlayerTrendsPanel } from "@/components/player-trends-panel";
import { PremierLeagueTable } from "@/components/premier-league-table";
import { RankChangePanel } from "@/components/rank-change-panel";
import { SidePanelLayout } from "@/components/side-panel-layout";
import { SubTabs } from "@/components/sub-tabs";
import { TeamFixtureTable } from "@/components/team-fixture-table";
import { RefreshIndicator } from "@/components/refresh-indicator";

async function fetchLeagueLive(leagueId: string, fallbackError: string, refresh = false) {
  const response = await fetch(
    `/api/league-live?leagueId=${leagueId}&gw=current${refresh ? "&refresh=1" : ""}`
  );

  if (!response.ok) {
    const payload = (await response.json()) as { error?: string };
    throw new Error(payload.error ?? fallbackError);
  }

  return (await response.json()) as LeagueLiveResponse;
}

async function fetchRankChange(leagueId: string, fallbackError: string) {
  const response = await fetch(`/api/league-rank-change?leagueId=${leagueId}`);

  if (!response.ok) {
    const payload = (await response.json()) as { error?: string };
    throw new Error(payload.error ?? fallbackError);
  }

  return (await response.json()) as RankChangeResponse;
}

async function fetchPlayerStats(leagueId: string, fallbackError: string) {
  const response = await fetch(`/api/player-stats?leagueId=${leagueId}&gw=current`);

  if (!response.ok) {
    const payload = (await response.json()) as { error?: string };
    throw new Error(payload.error ?? fallbackError);
  }

  return (await response.json()) as PlayerStatsResponse;
}

type Tab = "standings" | "team" | "player";
type StandingsView = "table" | "rank-change";
type TeamView = "fixtures" | "table";

export function LeagueDashboard({ leagueId, buildId }: { leagueId: string; buildId: string }) {
  const { tr } = useLocale();
  const [tab, setTab] = useState<Tab>("standings");
  const [standingsView, setStandingsView] = useState<StandingsView>("table");
  const [teamView, setTeamView] = useState<TeamView>("fixtures");
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["league-live", leagueId],
    queryFn: () => fetchLeagueLive(leagueId, tr("리그 데이터를 불러오지 못했습니다.", "Could not load league data.")),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: true
  });

  const rankChangeQuery = useQuery({
    queryKey: ["league-rank-change", leagueId],
    queryFn: () => fetchRankChange(leagueId, tr("순위 추이 데이터를 불러오지 못했습니다.", "Could not load rank trend data.")),
    enabled: tab === "standings" && standingsView === "rank-change",
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false
  });

  const playerStatsQuery = useQuery({
    queryKey: ["player-stats", leagueId],
    queryFn: () => fetchPlayerStats(leagueId, tr("선수 데이터를 불러오지 못했습니다.", "Could not load player data.")),
    enabled: tab === "player" || tab === "team",
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false
  });

  const tabs = useMemo(
    () => [
      { id: "standings", label: tr("주간 순위", "Standings") },
      { id: "team", label: tr("팀", "Teams") },
      { id: "player", label: tr("선수", "Players") }
    ] as const,
    [tr]
  );

  const isRankChangeTab = tab === "standings" && standingsView === "rank-change";
  const isPlayerTab = tab === "player" || tab === "team";

  // Force-refresh bypasses the server's 30s memo so the button means something.
  async function handleRefresh() {
    const fresh = await fetchLeagueLive(
      leagueId,
      tr("리그 데이터를 불러오지 못했습니다.", "Could not load league data."),
      true
    );
    queryClient.setQueryData(["league-live", leagueId], fresh);
    if (isRankChangeTab) {
      await rankChangeQuery.refetch();
    }
    if (isPlayerTab) {
      await playerStatsQuery.refetch();
    }
  }

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
          <div className="flex items-center justify-between gap-2">
            <Link
              href="/"
              className="text-[11px] uppercase tracking-[0.18em] text-[var(--muted)] transition hover:text-[var(--accent)] md:text-xs"
            >
              {tr("다른 리그 검색", "Search another league")}
            </Link>
            <LocaleToggle />
          </div>
          <h1 className="mt-1 text-2xl font-semibold leading-none md:text-3xl">
            {query.data?.league.name ??
              rankChangeQuery.data?.league.name ??
              playerStatsQuery.data?.league.name ??
              tr(`리그 ${leagueId}`, `League ${leagueId}`)}
          </h1>
          <p className="text-sm text-[var(--muted)]">
            {query.data
              ? tr(
                  `게임위크 ${query.data.league.currentGw} 라이브 대시보드`,
                  `Gameweek ${query.data.league.currentGw} live dashboard`
                )
              : rankChangeQuery.data
                ? tr(
                    `게임위크 ${rankChangeQuery.data.league.currentGw} 순위 기록`,
                    `Gameweek ${rankChangeQuery.data.league.currentGw} rank history`
                  )
                : playerStatsQuery.data
                  ? tr(
                      `게임위크 ${playerStatsQuery.data.league.currentGw} 선수 데이터`,
                      `Gameweek ${playerStatsQuery.data.league.currentGw} player data`
                    )
                  : tr("공식 FPL 데이터를 불러오는 중", "Loading official FPL data")}
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
          {tr(
            "FPL이 이 리그의 순위를 아직 내려주지 않고 있습니다. 순위 갱신 중이면 잠시 후 새로고침하면 나타납니다. 계속 비어 있으면 공개 클래식 리그 ID인지 확인해 주세요.",
            "FPL is not returning standings for this league yet. If it is mid-update, refresh in a few minutes. If it stays empty, check that it is a public classic league ID."
          )}
        </div>
      ) : null}

      {query.data || rankChangeQuery.data || playerStatsQuery.data ? (
        <>
          {query.data && query.data.errors.length > 0 && !isRankChangeTab && !isPlayerTab ? (
            <div className="mb-4 rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-[var(--warning)]">
              {tr(
                `매니저 ${query.data.errors.length}명의 데이터를 불러오지 못했습니다. 킥오프 후 자동 반영됩니다.`,
                `Could not load data for ${query.data.errors.length} manager(s). It will appear automatically after kickoff.`
              )}
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
            aria-label={tr("대시보드 보기", "Dashboard views")}
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

          {tab === "standings" ? (
            <div className="mb-2">
              <SubTabs<StandingsView>
                label={tr("주간 순위 보기", "Standings views")}
                items={[
                  { id: "table", label: tr("순위표", "Table") },
                  { id: "rank-change", label: tr("순위 추이", "Rank trend") }
                ]}
                value={standingsView}
                onChange={setStandingsView}
              />
            </div>
          ) : null}

          {tab === "team" ? (
            <div className="mb-2">
              <SubTabs<TeamView>
                label={tr("팀 보기", "Team views")}
                items={[
                  { id: "fixtures", label: tr("경기 일정", "Fixtures") },
                  { id: "table", label: tr("순위·일정 난이도", "Table & difficulty") }
                ]}
                value={teamView}
                onChange={setTeamView}
              />
            </div>
          ) : null}

          {tab === "standings" && standingsView === "table" && query.data ? (
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
          ) : null}

          {tab === "standings" && standingsView === "rank-change" && rankChangeQuery.data ? (
            <RankChangePanel data={rankChangeQuery.data} />
          ) : null}

          {tab === "team" && teamView === "fixtures" && query.data ? (
            <FixturesPanel
              fixtures={query.data.fixtures}
              currentGw={query.data.league.currentGw}
              rows={query.data.rows}
            />
          ) : null}

          {tab === "team" && teamView === "table" ? (
            playerStatsQuery.data ? (
              <>
                <TeamFixtureTable data={playerStatsQuery.data} />
                <PremierLeagueTable table={playerStatsQuery.data.table} />
              </>
            ) : (
              <div className="mt-3 rounded-[1.2rem] border border-[var(--border)] bg-[var(--surface)] px-4 py-6 text-center text-sm text-[var(--muted)]">
                {playerStatsQuery.error
                  ? tr("팀별 일정 난이도를 불러오지 못했습니다.", "Could not load team fixture difficulty.")
                  : tr("팀별 일정 난이도를 불러오는 중…", "Loading team fixture difficulty…")}
              </div>
            )
          ) : null}

          {tab === "player" && playerStatsQuery.data ? (
            <PlayerTrendsPanel data={playerStatsQuery.data} />
          ) : null}
        </>
      ) : null}

      <footer className="mt-auto pt-8 text-center text-[11px] text-[var(--muted)] opacity-70" title={tr("배포 버전", "Deployed version")}>
        build {buildId}
      </footer>
    </main>
  );
}
