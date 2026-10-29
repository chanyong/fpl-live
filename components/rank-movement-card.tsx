"use client";

import { useMemo } from "react";
import type { LeagueFixture, LeagueRow } from "@/lib/types";
import { summarizeRankMovement, type RankMove } from "@/lib/rank-movement";
import { useLocale } from "@/components/locale-provider";

/** One-glance summary of who climbed and who dropped this gameweek. */
export function RankMovementCard({ rows, fixtures, gw }: { rows: LeagueRow[]; fixtures: LeagueFixture[]; gw: number }) {
  const { tr } = useLocale();
  const summary = useMemo(() => summarizeRankMovement(rows), [rows]);
  const allDone = fixtures.length > 0 && fixtures.every((fixture) => fixture.finished || fixture.finishedProvisional);
  const anyStarted = fixtures.some((fixture) => fixture.started);

  const line = (move: RankMove, up: boolean) => (
    <li key={move.entryId} className="flex items-center justify-between gap-2">
      <span className="min-w-0 truncate">
        <b className="font-semibold">{move.managerName}</b>
        <span className="ml-1 text-[11px] text-[var(--muted)]">
          {move.from}→{move.to}
        </span>
      </span>
      <span className={`shrink-0 font-bold tabular-nums ${up ? "text-emerald-700" : "text-[var(--danger)]"}`}>
        {up ? "▲" : "▼"}
        {Math.abs(move.delta)}
      </span>
    </li>
  );

  return (
    <section className="rounded-[1.1rem] border border-[var(--border)] bg-[var(--surface)] p-3" aria-labelledby="rank-move-title">
      <h2 id="rank-move-title" className="text-sm font-semibold">
        {allDone
          ? tr(`GW ${gw} 경기 후 순위 변화`, `GW ${gw} final rank changes`)
          : tr(`GW ${gw} 순위 변화 (진행 중 잠정)`, `GW ${gw} rank changes (live)`)}
      </h2>
      <p className="text-[11px] text-[var(--muted)]">
        {tr("지난 GW 종료 순위 → 지금 잠정 순위", "Rank after last GW → projected rank now")}
      </p>

      {!anyStarted ? (
        <p className="mt-2 text-[12px] text-[var(--muted)]">{tr("첫 경기가 시작되면 순위 변화가 나타납니다.", "Changes appear once the first match kicks off.")}</p>
      ) : summary.comparable === 0 ? (
        <p className="mt-2 text-[12px] text-[var(--muted)]">{tr("이전 순위 정보가 없는 리그입니다.", "This league has no previous ranks yet.")}</p>
      ) : (
        <div className="mt-2 grid grid-cols-2 gap-2 text-[13px]">
          <div className="rounded-lg bg-white px-2 py-1.5">
            <div className="mb-1 text-[11px] font-semibold text-emerald-700">{tr("가장 많이 오름", "Biggest climbs")}</div>
            {summary.risers.length ? <ul className="space-y-0.5">{summary.risers.map((move) => line(move, true))}</ul> : <p className="text-[var(--muted)]">-</p>}
          </div>
          <div className="rounded-lg bg-white px-2 py-1.5">
            <div className="mb-1 text-[11px] font-semibold text-[var(--danger)]">{tr("가장 많이 내림", "Biggest drops")}</div>
            {summary.fallers.length ? <ul className="space-y-0.5">{summary.fallers.map((move) => line(move, false))}</ul> : <p className="text-[var(--muted)]">-</p>}
          </div>
        </div>
      )}

      {anyStarted && summary.topScorer ? (
        <p className="mt-2 text-[12px] text-[var(--muted)]">
          {tr("이번 GW 최고 점수", "Top GW score")}: <b className="text-[var(--text)]">{summary.topScorer.managerName}</b>{" "}
          <span className="tabular-nums">{tr(`${summary.topScorer.gwPoints}점`, `${summary.topScorer.gwPoints} pts`)}</span>
          {summary.comparable > 0 ? (
            <span> · {tr(`${summary.movedCount}명 순위 변동`, `${summary.movedCount} managers moved`)}</span>
          ) : null}
        </p>
      ) : null}
    </section>
  );
}
