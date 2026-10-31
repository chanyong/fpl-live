"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { parseLeagueId } from "@/lib/request-params";
import { useLocale } from "@/components/locale-provider";
import { loadRecentLeagues, rememberLeague, removeRecentLeague, saveRecentLeagues, type RecentLeague } from "@/lib/recent-leagues";

export function LeagueSearchForm() {
  const { tr } = useLocale();
  const router = useRouter();
  const [leagueId, setLeagueId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<RecentLeague[]>([]);

  useEffect(() => {
    // Read after mount: the list lives only in this browser.
    setRecent(loadRecentLeagues());
  }, []);

  function openLeague(nextLeagueId: string) {
    const existing = recent.find((item) => String(item.id) === nextLeagueId);
    rememberLeague(Number(nextLeagueId), existing?.name ?? null);
    router.push(`/league/${nextLeagueId}`);
  }

  function forget(id: number) {
    const next = removeRecentLeague(recent, id);
    saveRecentLeagues(next);
    setRecent(next);
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
        <p id="league-id-error" role="alert" className="text-body text-[var(--danger)]">
          {error}
        </p>
      ) : null}

      {recent.length > 0 ? (
        <div>
          <p className="text-body font-semibold text-[var(--muted)]">
            {tr("최근 본 리그", "Recent leagues")}
            <span className="ml-2 text-caption font-normal">{tr("(이 브라우저에만 저장)", "(saved in this browser only)")}</span>
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {recent.map((item) => (
              <li key={item.id} className="flex items-center rounded-full border border-[var(--border)] bg-white text-body">
                <button
                  type="button"
                  onClick={() => openLeague(String(item.id))}
                  className="max-w-[16rem] truncate rounded-l-full py-2 pl-4 pr-2 font-medium transition hover:text-[var(--accent)]"
                >
                  {item.name ? `${item.name} ` : ""}
                  <span className="text-caption text-[var(--muted)] tabular-nums">#{item.id}</span>
                </button>
                <button
                  type="button"
                  onClick={() => forget(item.id)}
                  aria-label={tr(`리그 ${item.id} 목록에서 지우기`, `Remove league ${item.id} from list`)}
                  className="rounded-r-full py-2 pl-1 pr-3 text-[var(--muted)] transition hover:text-[var(--danger)]"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
