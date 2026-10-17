"use client";

import { useEffect, useMemo } from "react";
import type { LeagueRow, PlayerLiveCard } from "@/lib/types";
import { compareSquads } from "@/lib/squad-compare";

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

        <div className="space-y-4 overflow-y-auto px-3 py-3 md:px-5 md:py-4">
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
  );
}
