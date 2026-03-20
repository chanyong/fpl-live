"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import type { LeagueLiveResponse, RankChangeResponse } from "@/lib/types";
import { CaptainStats } from "@/components/captain-stats";
import { FixturesPanel } from "@/components/fixtures-panel";
import { LeagueTable } from "@/components/league-table";
import { RankChangePanel } from "@/components/rank-change-panel";

async function fetchLeagueLive(leagueId: string, refresh = false) {
  const response = await fetch(
    `/api/league-live?leagueId=${leagueId}&gw=current${refresh ? "&refresh=1" : ""}`
  );

  if (!response.ok) {
    const payload = (await response.json()) as { error?: string };
    throw new Error(payload.error ?? "Failed to fetch league data");
  }

  return (await response.json()) as LeagueLiveResponse;
}

async function fetchRankChange(leagueId: string, refresh = false) {
  const response = await fetch(`/api/league-rank-change?leagueId=${leagueId}${refresh ? "&refresh=1" : ""}`);

  if (!response.ok) {
    const payload = (await response.json()) as { error?: string };
    throw new Error(payload.error ?? "Failed to fetch rank change data");
  }

  return (await response.json()) as RankChangeResponse;
}

export function LeagueDashboard({ leagueId, buildId }: { leagueId: string; buildId: string }) {
  const [tab, setTab] = useState<"standings" | "fixtures" | "rank-change">("standings");
  const query = useQuery({
    queryKey: ["league-live", leagueId],
    queryFn: () => fetchLeagueLive(leagueId, true),
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false
  });
  const rankChangeQuery = useQuery({
    queryKey: ["league-rank-change", leagueId],
    queryFn: () => fetchRankChange(leagueId, true),
    enabled: tab === "rank-change",
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false
  });

  const tabs = useMemo(
    () => [
      { id: "standings", label: "Weekly Rank" },
      { id: "fixtures", label: "Fixtures" },
      { id: "rank-change", label: "Rank Change" }
    ] as const,
    []
  );

  return (
    <main className="mx-auto flex min-h-screen max-w-[1080px] flex-col px-2 py-3 sm:px-3 md:px-3 md:py-5 lg:max-w-[1120px]">
      <div className="mb-4 flex flex-col gap-3 md:mb-5 md:flex-row md:items-center md:justify-between md:gap-3">
        <div className="min-w-0">
          <Link href="/" className="text-[11px] uppercase tracking-[0.18em] text-[var(--muted)] md:text-xs">
            Search another league
          </Link>
          <h1 className="mt-1 text-[2rem] font-semibold leading-none md:mt-2 md:text-[2rem]">
            {query.data?.league.name ?? rankChangeQuery.data?.league.name ?? `League ${leagueId}`}
          </h1>
          <p className="mt-1 text-[16px] text-[var(--muted)] md:text-base">
            {query.data
              ? `Gameweek ${query.data.league.currentGw} live dashboard`
              : rankChangeQuery.data
                ? `Gameweek ${rankChangeQuery.data.league.currentGw} rank history`
                : "Loading official FPL data"}
          </p>
        </div>
      </div>

      {query.isLoading && tab !== "rank-change" ? (
        <div className="grid gap-3">
          {Array.from({ length: 8 }).map((_, index) => (
            <div
              key={index}
              className="h-16 animate-pulse rounded-2xl border border-[var(--border)] bg-[var(--surface)]/80"
            />
          ))}
        </div>
      ) : null}

      {rankChangeQuery.isLoading && tab === "rank-change" ? (
        <div className="grid gap-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="h-24 animate-pulse rounded-2xl border border-[var(--border)] bg-[var(--surface)]/80"
            />
          ))}
        </div>
      ) : null}

      {query.isError && tab !== "rank-change" ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-[var(--danger)]">
          {(query.error as Error).message}
        </div>
      ) : null}

      {rankChangeQuery.isError && tab === "rank-change" ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-[var(--danger)]">
          {(rankChangeQuery.error as Error).message}
        </div>
      ) : null}

      {query.data && query.data.rows.length === 0 ? (
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6">
          No standings were returned for this league.
        </div>
      ) : null}

      {(query.data || rankChangeQuery.data) ? (
        <>
          {query.data && query.data.errors.length > 0 && tab !== "rank-change" ? (
            <div className="mb-4 rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-[var(--warning)]">
              일부 매니저 데이터를 불러오지 못했습니다. 킥오프 후 자동 반영됩니다.
            </div>
          ) : null}

          <div className="mb-3 inline-flex w-full rounded-[1rem] border border-[var(--border)] bg-[var(--surface)] p-1 md:mb-4 md:w-auto">
            {tabs.map((item) => {
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`flex-1 rounded-[0.8rem] px-4 py-2 text-sm font-semibold md:flex-none ${
                    active ? "bg-[var(--text)] text-white" : "text-[var(--muted)]"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          {tab === "standings" && query.data ? (
            <>
              <CaptainStats stats={query.data.captainStats} />
              <LeagueTable data={query.data} />
            </>
          ) : null}

          {tab === "fixtures" && query.data ? (
            <FixturesPanel fixtures={query.data.fixtures} currentGw={query.data.league.currentGw} />
          ) : null}

          {tab === "rank-change" && rankChangeQuery.data ? <RankChangePanel data={rankChangeQuery.data} /> : null}
        </>
      ) : null}
    </main>
  );
}
