"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { parseLeagueId } from "@/lib/request-params";
import { useLocale } from "@/components/locale-provider";

const STORAGE_KEY = "recentLeagueId";

export function LeagueSearchForm() {
  const { tr } = useLocale();
  const router = useRouter();
  const [leagueId, setLeagueId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [recentLeagueId, setRecentLeagueId] = useState<string | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    // An earlier build saved whatever was typed, including invite codes.
    if (stored && "leagueId" in parseLeagueId(stored)) {
      setRecentLeagueId(stored);
    } else if (stored) {
      window.localStorage.removeItem(STORAGE_KEY);
    }
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
          const parsed = parseLeagueId(leagueId.trim());

          if ("error" in parsed) {
            setError(
              tr(
                "리그 ID는 숫자입니다. bfwf45 같은 초대 코드가 아니라, FPL 주소 fantasy.premierleague.com/leagues/915874/ 의 숫자를 입력해 주세요.",
                "A league ID is a number. Enter the number from the FPL address (fantasy.premierleague.com/leagues/915874/), not an invite code like bfwf45."
              )
            );
            return;
          }

          setError(null);
          openLeague(String(parsed.leagueId));
        }}
      >
        <input
          value={leagueId}
          onChange={(event) => {
            setLeagueId(event.target.value);
            if (error) {
              setError(null);
            }
          }}
          inputMode="numeric"
          aria-label={tr("공개 클래식 리그 ID", "Public classic league ID")}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "league-id-error" : undefined}
          placeholder={tr("공개 클래식 리그 ID (예: 915874)", "Public classic league ID (e.g. 915874)")}
          className={`min-h-14 flex-1 rounded-full border bg-white px-6 text-lg outline-none transition focus:border-[var(--accent)] ${
            error ? "border-red-400" : "border-[var(--border)]"
          }`}
        />
        <button
          type="submit"
          className="min-h-14 rounded-full bg-[var(--accent)] px-8 font-semibold text-white transition hover:opacity-90"
        >
          {tr("대시보드 열기", "Open dashboard")}
        </button>
      </form>

      {error ? (
        <p id="league-id-error" role="alert" className="text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}

      {recentLeagueId ? (
        <button
          type="button"
          className="w-fit text-sm text-[var(--muted)] underline underline-offset-4 transition hover:text-[var(--accent)]"
          onClick={() => openLeague(recentLeagueId)}
        >
          {tr(`최근 본 리그 ${recentLeagueId} 다시 열기`, `Reopen recent league ${recentLeagueId}`)}
        </button>
      ) : null}
    </div>
  );
}
