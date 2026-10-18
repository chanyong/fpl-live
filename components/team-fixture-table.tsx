"use client";

import { useMemo, useState } from "react";
import { difficultyStyle } from "@/components/fdr-strip";
import { useLocale } from "@/components/locale-provider";
import { RemoteImage, crestUrl } from "@/components/remote-image";
import { averageDifficulty } from "@/lib/player-metrics";
import type { PlayerStatsResponse, TeamFixtureOutlook } from "@/lib/types";

/** Gameweeks shown after the current one. */
const WINDOW = 5;

/** "average" and "team" are the fixed columns; a number is a gameweek. */
type SortKey = "average" | "team" | number;
type SortDir = "asc" | "desc";

type Row = {
  team: string;
  teamCode: number;
  byGw: Map<number, TeamFixtureOutlook[]>;
  average: number | null;
};

function FixtureCell({ fixtures }: { fixtures: TeamFixtureOutlook[] | undefined }) {
  const { tr } = useLocale();

  if (!fixtures || fixtures.length === 0) {
    return (
      <div
        className="rounded-[6px] border border-dashed border-[var(--border)] px-1 py-1.5 text-center text-[11px] text-[var(--muted)]"
        title={tr("이 게임위크에는 경기가 없습니다", "No fixture this gameweek")}
      >
        -
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[2px]">
      {fixtures.map((fixture, index) => (
        <div
          key={index}
          className="rounded-[6px] px-1 py-1 text-center text-[11px] font-semibold leading-tight"
          style={difficultyStyle(fixture.difficulty)}
          title={tr(
            `GW${fixture.gw} · ${fixture.home ? "홈" : "원정"} ${fixture.opponent} · 난이도 ${fixture.difficulty}`,
            `GW${fixture.gw} · ${fixture.home ? "Home" : "Away"} ${fixture.opponent} · difficulty ${fixture.difficulty}`
          )}
        >
          {fixture.opponent} <span className="font-normal opacity-80">({fixture.home ? tr("홈", "H") : tr("원정", "A")})</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Which teams have the kind way through the next few gameweeks.
 *
 * Difficulty is FPL's own 1-5 rating of the opponent from this team's side, home or away, so a
 * low average reads as an easy run. Blank gameweeks show a dash and double gameweeks stack two
 * cells; the average only counts fixtures actually inside the window.
 */
export function TeamFixtureTable({ data }: { data: PlayerStatsResponse }) {
  const { tr } = useLocale();
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "average", dir: "asc" });

  const firstGw = data.league.currentGw + 1;
  const gameweeks = useMemo(() => Array.from({ length: WINDOW }, (_, index) => firstGw + index), [firstGw]);

  const rows = useMemo(() => {
    const codeByTeam = new Map<string, number>();
    for (const player of data.players) {
      codeByTeam.set(player.teamShortName, player.teamCode);
    }

    const built: Row[] = Object.entries(data.fdr).map(([team, fixtures]) => {
      const inWindow = fixtures.filter((fixture) => fixture.gw >= firstGw && fixture.gw < firstGw + WINDOW);
      const byGw = new Map<number, TeamFixtureOutlook[]>();
      for (const fixture of inWindow) {
        byGw.set(fixture.gw, [...(byGw.get(fixture.gw) ?? []), fixture]);
      }

      return { team, teamCode: codeByTeam.get(team) ?? 0, byGw, average: averageDifficulty(inWindow) };
    });

    const value = (row: Row) =>
      sort.key === "average"
        ? row.average
        : typeof sort.key === "number"
          ? averageDifficulty(row.byGw.get(sort.key) ?? [])
          : null;
    const sign = sort.dir === "asc" ? 1 : -1;

    return built.sort((left, right) => {
      if (sort.key === "team") {
        return sign * left.team.localeCompare(right.team);
      }

      const a = value(left);
      const b = value(right);
      // Blank gameweeks and teams with nothing left sort last in either direction rather than
      // posing as the easiest run.
      if (a === null || b === null) {
        return (a === null ? 1 : 0) - (b === null ? 1 : 0) || left.team.localeCompare(right.team);
      }
      return sign * (a - b) || left.team.localeCompare(right.team);
    });
  }, [data.fdr, data.players, firstGw, sort]);

  const toggleSort = (key: SortKey) =>
    setSort((current) =>
      current.key === key
        ? { key, dir: current.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" }
    );

  const headerButton = (key: SortKey, label: string, title?: string) => {
    const active = sort.key === key;

    return (
      <button
        type="button"
        title={title}
        onClick={() => toggleSort(key)}
        className={`inline-flex items-center gap-0.5 rounded px-1 py-0.5 font-semibold transition hover:text-[var(--accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
          active ? "text-[var(--text)]" : ""
        }`}
      >
        {label}
        <span aria-hidden="true" className={active ? "" : "opacity-30"}>
          {active ? (sort.dir === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </button>
    );
  };

  return (
    <section className="mt-3 rounded-[1.2rem] border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-[0_12px_36px_rgba(55,40,20,0.07)] md:p-2">
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-1.5 px-1.5">
        <div>
          <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
            {tr("팀별 향후 일정 난이도", "Upcoming fixture difficulty by team")}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--muted)]">
            <span>{tr("쉬움", "Easy")}</span>
            {[1, 2, 3, 4, 5].map((level) => (
              <span
                key={level}
                className="inline-flex h-[16px] w-[16px] items-center justify-center rounded-[3px] text-[10px] font-semibold tabular-nums"
                style={difficultyStyle(level)}
              >
                {level}
              </span>
            ))}
            <span>{tr("어려움 · 상대 팀 기준 FPL 난이도", "Hard · FPL rating of the opponent")}</span>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-separate border-spacing-y-[3px] px-1 text-left">
          <thead>
            <tr className="text-[11px] font-semibold text-[var(--muted)]">
              <th className="px-1 py-1" aria-sort={sort.key === "team" ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
                {headerButton("team", tr("팀", "Team"))}
              </th>
              <th className="px-1 py-1 text-center" aria-sort={sort.key === "average" ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
                {headerButton(
                  "average",
                  tr("평균", "Avg"),
                  tr(`다음 ${WINDOW}개 게임위크 평균 (낮을수록 쉬움)`, `Average over the next ${WINDOW} gameweeks (lower is easier)`)
                )}
              </th>
              {gameweeks.map((gw) => (
                <th key={gw} className="px-1 py-1 text-center" aria-sort={sort.key === gw ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
                  {headerButton(gw, `GW${gw}`, tr(`GW${gw} 난이도 순 정렬`, `Sort by GW${gw} difficulty`))}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.team} className="align-middle">
                <td className="px-2 py-0.5">
                  <span className="flex items-center gap-1.5 text-[13px] font-semibold">
                    <RemoteImage
                      src={crestUrl(row.teamCode)}
                      alt=""
                      fallback={row.team.slice(0, 1)}
                      className="h-5 w-5 shrink-0 object-contain"
                      fallbackClassName="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--surface-strong)] text-[9px] font-semibold text-[var(--muted)]"
                    />
                    {row.team}
                  </span>
                </td>
                <td className="px-1 py-0.5 text-center">
                  {row.average === null ? (
                    <span className="text-[11px] text-[var(--muted)]">-</span>
                  ) : (
                    <span
                      className="inline-flex min-w-[34px] justify-center rounded-[4px] px-1 py-[1px] text-[12px] font-semibold tabular-nums"
                      style={difficultyStyle(row.average)}
                    >
                      {row.average.toFixed(1)}
                    </span>
                  )}
                </td>
                {gameweeks.map((gw) => (
                  <td key={gw} className="px-1 py-0.5">
                    <FixtureCell fixtures={row.byGw.get(gw)} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
