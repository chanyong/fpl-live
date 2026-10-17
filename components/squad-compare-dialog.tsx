"use client";

import { useEffect, useMemo } from "react";
import type { LeagueRow, PlayerLiveCard } from "@/lib/types";
import { COMPARE_POSITIONS, compareSquads, pointsByPosition } from "@/lib/squad-compare";

const positionLabel = {
  GKP: "골키퍼",
  DEF: "수비수",
  MID: "미드필더",
  FWD: "공격수"
};

function PlayerPill({ player, tone }: { player: PlayerLiveCard; tone: string }) {
  return (
    <div className={`rounded-lg border px-2 py-1.5 ${tone}`}>
      <div className="truncate text-[13px] font-semibold leading-4 md:text-sm">{player.webName}</div>
      <div className="mt-0.5 flex items-center justify-between gap-1 text-[11px] leading-4 text-[var(--muted)]">
        <span className="truncate">{player.teamShortName}</span>
        <span className="tabular-nums">{player.status === "not_played" ? "-" : `${player.livePoints}점`}</span>
      </div>
    </div>
  );
}

/** How much of the fifteen the two managers share, as a ring with the count inside. */
function SharedRing({ shared, total }: { shared: number; total: number }) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;

  return (
    <div
      className="relative h-16 w-16"
      role="img"
      aria-label={`공통 ${shared}명 / ${total}명`}
    >
      <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90">
        <circle cx="32" cy="32" r={radius} fill="none" stroke="var(--chart-mute-soft)" strokeWidth="7" />
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${(shared / total) * circumference} ${circumference}`}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-sm font-semibold tabular-nums">
        {shared}/{total}
      </div>
    </div>
  );
}

/** Mirrored bars: each position's gameweek points, one manager growing left and one right. */
function PositionBars({ a, b }: { a: LeagueRow; b: LeagueRow }) {
  const pointsA = pointsByPosition(a);
  const pointsB = pointsByPosition(b);
  const max = Math.max(1, ...COMPARE_POSITIONS.flatMap((position) => [pointsA[position], pointsB[position]]));
  const totalA = COMPARE_POSITIONS.reduce((sum, position) => sum + pointsA[position], 0);
  const totalB = COMPARE_POSITIONS.reduce((sum, position) => sum + pointsB[position], 0);
  const width = (value: number) => `${Math.max(value, 0) / max * 100}%`;

  return (
    <section className="border-b border-[var(--border)] px-3 py-3 md:px-5">
      <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">포지션별 GW 득점</h3>
      <p className="mb-2 text-[11px] text-[var(--muted)]">
        포지션별로 선발 11명이 얻은 점수 합계입니다 (주장 2배 반영, 벤치·이적 차감 제외)
      </p>
      <ul className="space-y-1.5">
        {COMPARE_POSITIONS.map((position) => (
          <li
            key={position}
            className="grid grid-cols-[2.5rem_minmax(0,1fr)_2.75rem_minmax(0,1fr)_2.5rem] items-center gap-1.5 text-[12px] tabular-nums md:grid-cols-[3rem_minmax(0,1fr)_3rem_minmax(0,1fr)_3rem]"
          >
            <span className="text-right font-semibold" style={{ color: "var(--chart-in)" }}>
              {pointsA[position]}점
            </span>
            <span className="flex h-3 justify-end overflow-hidden rounded-l-full bg-[var(--chart-mute-soft)]/50">
              <span className="h-full rounded-l-full" style={{ width: width(pointsA[position]), backgroundColor: "var(--chart-in)" }} />
            </span>
            <span className="text-center text-[11px] font-semibold text-[var(--muted)]">{position}</span>
            <span className="flex h-3 overflow-hidden rounded-r-full bg-[var(--chart-mute-soft)]/50">
              <span className="h-full rounded-r-full" style={{ width: width(pointsB[position]), backgroundColor: "var(--chart-out)" }} />
            </span>
            <span className="font-semibold" style={{ color: "var(--chart-out)" }}>
              {pointsB[position]}점
            </span>
          </li>
        ))}
        <li className="grid grid-cols-[2.5rem_minmax(0,1fr)_2.75rem_minmax(0,1fr)_2.5rem] items-center gap-1.5 border-t border-[var(--border)] pt-1.5 text-[12px] font-semibold tabular-nums md:grid-cols-[3rem_minmax(0,1fr)_3rem_minmax(0,1fr)_3rem]">
          <span className="text-right" style={{ color: "var(--chart-in)" }}>{totalA}점</span>
          <span />
          <span className="text-center text-[11px] text-[var(--muted)]">합계</span>
          <span />
          <span style={{ color: "var(--chart-out)" }}>{totalB}점</span>
        </li>
      </ul>
      <div className="mt-2 flex justify-between text-[11px] font-semibold">
        <span className="flex items-center gap-1" style={{ color: "var(--chart-in)" }}>
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "var(--chart-in)" }} />
          {a.teamName}
        </span>
        <span className="flex items-center gap-1" style={{ color: "var(--chart-out)" }}>
          {b.teamName}
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "var(--chart-out)" }} />
        </span>
      </div>
    </section>
  );
}

/** One position as a row-aligned grid, so both squads read straight across. */
function PositionGrid({
  columns,
  tones
}: {
  columns: [PlayerLiveCard[], PlayerLiveCard[], PlayerLiveCard[]];
  tones: [string, string, string];
}) {
  const rows = Math.max(...columns.map((players) => players.length));

  if (rows === 0) {
    return <div className="py-2 text-center text-xs text-[var(--muted)]">-</div>;
  }

  return (
    <ul className="grid grid-cols-[repeat(3,minmax(0,1fr))] gap-y-1.5">
      {Array.from({ length: rows }).flatMap((_, rowIndex) =>
        columns.map((players, columnIndex) => {
          const player = players[rowIndex];

          return (
            <li
              key={`${rowIndex}-${columnIndex}`}
              className={`px-1 ${columnIndex === 1 ? "border-x border-[var(--border)]" : ""}`}
            >
              {player ? <PlayerPill player={player} tone={tones[columnIndex]} /> : null}
            </li>
          );
        })
      )}
    </ul>
  );
}

export function SquadCompareDialog({
  a,
  b,
  onClose
}: {
  a: LeagueRow;
  b: LeagueRow;
  onClose: () => void;
}) {
  const comparison = useMemo(() => compareSquads(a, b), [a, b]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const toneA = "border-sky-200 bg-sky-50";
  const toneShared = "border-emerald-200 bg-emerald-50";
  const toneB = "border-rose-200 bg-rose-50";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center md:p-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="스쿼드 비교"
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-[1.4rem] border border-[var(--border)] bg-[var(--surface)] shadow-2xl md:max-w-3xl md:rounded-[1.4rem]"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-3 py-3 md:px-5">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold leading-6">스쿼드 비교</h2>
            <p className="text-xs text-[var(--muted)]">
              게임위크 라인업 15명 기준 · 공통 {comparison.sharedCount}명
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[var(--border)] bg-white text-lg leading-none"
          >
            ×
          </button>
        </div>

        <div className="grid grid-cols-[repeat(3,minmax(0,1fr))] items-center gap-2 border-b border-[var(--border)] px-3 py-3 text-center md:px-5">
          <div className="min-w-0">
            <div className="text-xl font-semibold tabular-nums md:text-2xl">{a.gwPoints}</div>
            <div className="text-[11px] text-[var(--muted)]">GW · 총 {a.totalPoints}</div>
          </div>
          <div className="mx-auto">
            <SharedRing shared={comparison.sharedCount} total={15} />
          </div>
          <div className="min-w-0">
            <div className="text-xl font-semibold tabular-nums md:text-2xl">{b.gwPoints}</div>
            <div className="text-[11px] text-[var(--muted)]">GW · 총 {b.totalPoints}</div>
          </div>
        </div>

        <div className="grid grid-cols-[repeat(3,minmax(0,1fr))] gap-2 border-b border-[var(--border)] bg-[var(--surface-strong)]/40 px-3 py-2 text-center md:px-5">
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold md:text-sm">{a.teamName}</div>
            <div className="text-[11px] text-sky-700">단독 보유 {comparison.onlyACount}</div>
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-semibold md:text-sm">공통</div>
            <div className="text-[11px] text-emerald-700">{comparison.sharedCount}명</div>
          </div>
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold md:text-sm">{b.teamName}</div>
            <div className="text-[11px] text-rose-700">단독 보유 {comparison.onlyBCount}</div>
          </div>
        </div>

        <div className="overflow-y-auto">
        <PositionBars a={a} b={b} />
        <div className="space-y-4 px-3 py-3 md:px-5 md:py-4">
          {comparison.positions.map((group) => (
            <section key={group.position}>
              <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                {positionLabel[group.position]} ({group.position})
              </h3>
              <PositionGrid
                columns={[group.onlyA, group.shared, group.onlyB]}
                tones={[toneA, toneShared, toneB]}
              />
            </section>
          ))}
          </div>
        </div>
      </div>
    </div>
  );
}
