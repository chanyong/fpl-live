"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const STORAGE_KEY = "recentLeagueId";

export function LeagueSearchForm() {
  const router = useRouter();
  const [leagueId, setLeagueId] = useState("");
  const [recentLeagueId, setRecentLeagueId] = useState<string | null>(null);

  useEffect(() => {
    setRecentLeagueId(window.localStorage.getItem(STORAGE_KEY));
  }, []);

  function openLeague(nextLeagueId: string) {
    window.localStorage.setItem(STORAGE_KEY, nextLeagueId);
    router.push(`/league/${nextLeagueId}`);
  }

  return (
    <div className="mt-10 flex flex-col gap-4">
      <form
        className="flex flex-col gap-3 md:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          const trimmed = leagueId.trim();
          if (!trimmed) {
            return;
          }

          openLeague(trimmed);
        }}
      >
        <input
          value={leagueId}
          onChange={(event) => setLeagueId(event.target.value)}
          inputMode="numeric"
          placeholder="Enter public classic league ID"
          className="min-h-14 flex-1 rounded-full border border-[var(--border)] bg-white px-6 text-lg outline-none transition focus:border-[var(--accent)]"
        />
        <button
          type="submit"
          className="min-h-14 rounded-full bg-[var(--accent)] px-8 font-semibold text-white transition hover:opacity-90"
        >
          Open dashboard
        </button>
      </form>
      {recentLeagueId ? (
        <button
          type="button"
          className="w-fit text-sm text-[var(--muted)] underline underline-offset-4"
          onClick={() => openLeague(recentLeagueId)}
        >
          Reopen recent league {recentLeagueId}
        </button>
      ) : null}
    </div>
  );
}
