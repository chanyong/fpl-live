"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import type { LeagueLiveResponse } from "@/lib/types";
import { CaptainStats } from "@/components/captain-stats";
import { LeagueTable } from "@/components/league-table";
import { RefreshIndicator } from "@/components/refresh-indicator";

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

export function LeagueDashboard({ leagueId, buildId }: { leagueId: string; buildId: string }) {
  const query = useQuery({
    queryKey: ["league-live", leagueId],
    queryFn: () => fetchLeagueLive(leagueId, true),
    refetchInterval: 30_000
  });

  return (
    <main className="mx-auto flex min-h-screen max-w-[1240px] flex-col px-2 py-3 sm:px-3 md:px-4 md:py-6">
      <div className="mb-4 flex flex-col gap-3 md:mb-5 md:flex-row md:items-center md:justify-between md:gap-4">
        <div className="min-w-0">
          <Link href="/" className="text-[11px] uppercase tracking-[0.18em] text-[var(--muted)] md:text-sm">
            Search another league
          </Link>
          <h1 className="mt-1 text-[2rem] font-semibold leading-none md:mt-2 md:text-3xl">
            {query.data?.league.name ?? `League ${leagueId}`}
          </h1>
          <p className="mt-1 text-xs text-[var(--muted)] md:text-sm">
            {query.data
              ? `Gameweek ${query.data.league.currentGw} live dashboard`
              : "Loading official FPL data"}
          </p>
        </div>
        <RefreshIndicator
          lastUpdated={query.data?.league.lastUpdated ?? null}
          isFetching={query.isFetching}
          buildId={buildId}
        />
      </div>

      {query.isLoading ? (
        <div className="grid gap-3">
          {Array.from({ length: 8 }).map((_, index) => (
            <div
              key={index}
              className="h-16 animate-pulse rounded-2xl border border-[var(--border)] bg-[var(--surface)]/80"
            />
          ))}
        </div>
      ) : null}

      {query.isError ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-[var(--danger)]">
          {(query.error as Error).message}
        </div>
      ) : null}

      {query.data && query.data.rows.length === 0 ? (
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6">
          No standings were returned for this league.
        </div>
      ) : null}

      {query.data ? (
        <>
          {query.data.errors.length > 0 ? (
            <div className="mb-4 rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-[var(--warning)]">
              Some managers could not be fully hydrated from the FPL API. Partial rows are still shown.
            </div>
          ) : null}
          <CaptainStats stats={query.data.captainStats} />
          <LeagueTable data={query.data} />
        </>
      ) : null}
    </main>
  );
}
