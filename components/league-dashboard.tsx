"use client";

import { useEffect, useMemo, useState } from "react";
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
import { ShareButton } from "@/components/share-button";
import { RefreshIndicator } from "@/components/refresh-indicator";
import { RivalCard, useRivalPick } from "@/components/rival-card";
import { RankMovementCard } from "@/components/rank-movement-card";
import { rememberLeague } from "@/lib/recent-leagues";

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
type StandingsView = "table" | "rank-change" | "fixtures";

export function LeagueDashboard({ leagueId, buildId }: { leagueId: string; buildId: string }) {
  const { tr } = useLocale();
  const [tab, setTab] = useState<Tab>("standings");
  const [standingsView, setStandingsView] = useState<StandingsView>("fixtures");
  // Held here, not in RivalCard: the card unmounts on the 팀·선수 tabs. Not saved, so a new visit starts empty.
  const [rivalPick, setRivalPick] = useRivalPick(leagueId);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["league-live", leagueId],
    queryFn: () => fetchLeagueLive(leagueId, tr("리그 데이터를 불러오지 못했습니다.", "Could not load league data.")),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: true
  });

  // Keep this league in the home page's "recent leagues" list (this browser only).
  const leagueName = query.data?.league.name ?? null;
  useEffect(() => {
    const id = Number(leagueId);
    if (Number.isInteger(id) && id > 0 && leagueName) {
      rememberLeague(id, leagueName);
    }
  }, [leagueId, leagueName]);

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
      <div className="mb-1 flex flex-wrap items-center justify-end gap-2">
        <ShareButton leagueName={query.data?.league.name} />
        <Link
          href="/"
          className="inline-flex shrink-0 items-center rounded-md border border-[var(--border)] bg-[var(--bg)] px-3.5 py-1.5 text-caption font-semibold text-[var(--text)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          {tr("다른 리그 검색", "Search another league")}
        </Link>
        <LocaleToggle />
      </div>
      <div className="mb-2 flex flex-col gap-2 md:mb-3 md:flex-row md:items-end md:justify-between md:gap-3">
        <div className="min-w-0">
          <h1 className="mt-1 text-2xl font-extrabold leading-tight tracking-tight md:text-3xl">
            {query.data?.league.name ??
              rankChangeQuery.data?.league.name ??
              playerStatsQuery.data?.league.name ??
              tr(`리그 ${leagueId}`, `League ${leagueId}`)}
          </h1>
          <p className="mt-1 text-caption text-[var(--muted)]">
            {query.data
              ? tr(
                  `GW ${query.data.league.currentGw} · 갱신 ${new Date(query.data.league.lastUpdated).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} · 잠정 점수, 30초마다`,
                  `GW ${query.data.league.currentGw} · updated ${new Date(query.data.league.lastUpdated).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} · live points, every 30s`
                )
              : rankChangeQuery.data
                ? tr(`GW ${rankChangeQuery.data.league.currentGw} 순위 기록`, `GW ${rankChangeQuery.data.league.currentGw} rank history`)
                : playerStatsQuery.data
                  ? tr(`GW ${playerStatsQuery.data.league.currentGw} 선수 데이터`, `GW ${playerStatsQuery.data.league.currentGw} player data`)
                  : tr("불러오는 중", "Loading")}
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
        <div className="grid grid-cols-1 gap-3">
          {Array.from({ length: isRankChangeTab ? 6 : 8 }).map((_, index) => (
            <div
              key={index}
              className={`animate-pulse rounded-md border border-[var(--border)] bg-[var(--surface)]/80 ${
                isRankChangeTab ? "h-24" : "h-16"
              }`}
            />
          ))}
        </div>
      ) : null}

      {activeError ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-6 text-[var(--danger)]">
          {(activeError as Error).message}
        </div>
      ) : null}

      {query.data && query.data.rows.length === 0 ? (
        <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] p-6">
          {tr(
            "FPL이 아직 순위를 내려주지 않았습니다. 잠시 후 새로고침하세요.",
            "FPL has no standings for this league yet. Refresh shortly."
          )}
        </div>
      ) : null}

      {query.data || rankChangeQuery.data || playerStatsQuery.data ? (
        <>
          {query.data && query.data.errors.length > 0 && !isRankChangeTab && !isPlayerTab ? (
            <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-4 text-body text-[var(--warning)]">
              {tr(
                `매니저 ${query.data.errors.length}명 데이터 없음. 킥오프 후 반영됩니다.`,
                `${query.data.errors.length} manager(s) missing; appears after kickoff.`
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
            className="mb-2 flex w-full gap-1 overflow-x-auto rounded-md border border-[var(--border)] bg-[var(--surface)] p-1 md:w-auto"
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
                  className={`flex-1 whitespace-nowrap rounded-md px-3 py-1.5 text-body font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] md:flex-none md:px-4 ${
                    active ? "bg-[var(--accent)] text-white" : "text-[var(--muted)] hover:text-[var(--text)]"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          {tab === "standings" && query.data && query.data.rows.length > 1 ? (
            <div className="mb-2 grid items-start gap-2 md:grid-cols-2">
              <RivalCard rows={query.data.rows} pick={rivalPick} onPickChange={setRivalPick} />
              <RankMovementCard rows={query.data.rows} fixtures={query.data.fixtures} gw={query.data.league.currentGw} />
            </div>
          ) : null}

          {tab === "standings" ? (
            <div className="mb-2">
              <SubTabs<StandingsView>
                label={tr("주간 순위 보기", "Standings views")}
                items={[
                  { id: "fixtures", label: tr("경기 일정", "Fixtures") },
                  { id: "table", label: tr("순위표", "Table") },
                  { id: "rank-change", label: tr("순위 추이", "Rank trend") }
                ]}
                value={standingsView}
                onChange={setStandingsView}
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

          {tab === "standings" && standingsView === "fixtures" && query.data ? (
            <FixturesPanel
              fixtures={query.data.fixtures}
              currentGw={query.data.league.currentGw}
              rows={query.data.rows}
            />
          ) : null}

          {tab === "team" ? (
            playerStatsQuery.data ? (
              <>
                <TeamFixtureTable data={playerStatsQuery.data} />
                <PremierLeagueTable table={playerStatsQuery.data.table} />
              </>
            ) : (
              <div className="mt-3 rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-6 text-center text-body text-[var(--muted)]">
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

      <footer className="mt-auto pt-8 text-center text-caption text-[var(--muted)]" title={tr("배포 버전", "Deployed version")}>
        build {buildId}
      </footer>
    </main>
  );
}
