"use client";

import { useEffect, useMemo } from "react";
import type { LeagueRow, PlayerLiveCard } from "@/lib/types";
import { COMPARE_POSITIONS, compareSquads, pointsByPosition } from "@/lib/squad-compare";
import { useLocale } from "@/components/locale-provider";

const positionLabel = {
  GKP: { ko: "골키퍼", en: "Goalkeepers" },
  DEF: { ko: "수비수", en: "Defenders" },
  MID: { ko: "미드필더", en: "Midfielders" },
  FWD: { ko: "공격수", en: "Forwards" }
};

function PlayerPill({ player, tone }: { player: PlayerLiveCard; tone: string }) {
  const { tr } = useLocale();
  return (
    <div className={`rounded-md border px-2 py-1.5 ${tone}`}>
      <div className="truncate text-meta font-semibold leading-4 md:text-body">{player.webName}</div>
      <div className="mt-0.5 flex items-center justify-between gap-1 text-caption leading-4 text-[var(--muted)]">
        <span className="truncate">{player.teamShortName}</span>
        <span className="tabular-nums">{player.status === "not_played" ? "-" : `${player.livePoints}${tr("점", " pts")}`}</span>
      </div>
    </div>
  );
}

/** How much of the fifteen the two managers share, as a ring with the count inside. */
function SharedRing({ shared, total }: { shared: number; total: number }) {
  const { tr } = useLocale();
  const radius = 26;
  const circumference = 2 * Math.PI * radius;

  return (
    <div
      className="relative h-16 w-16"
      role="img"
      aria-label={tr(`공통 ${shared}명 / ${total}명`, `${shared} of ${total} shared`)}
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
      <div className="absolute inset-0 grid place-items-center text-body font-semibold tabular-nums">
        {shared}/{total}
      </div>
    </div>
  );
}

/** Mirrored bars: each position's gameweek points, one manager growing left and one right. */
function PositionBars({ a, b }: { a: LeagueRow; b: LeagueRow }) {
  const { tr } = useLocale();
  const pointsA = pointsByPosition(a);
  const pointsB = pointsByPosition(b);
  const max = Math.max(1, ...COMPARE_POSITIONS.flatMap((position) => [pointsA[position], pointsB[position]]));
  const totalA = COMPARE_POSITIONS.reduce((sum, position) => sum + pointsA[position], 0);
  const totalB = COMPARE_POSITIONS.reduce((sum, position) => sum + pointsB[position], 0);
  const width = (value: number) => `${Math.max(value, 0) / max * 100}%`;

  return (
    <section className="border-b border-[var(--border)] px-3 py-3 md:px-5">
      <h3 className="text-caption font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
        {tr("포지션별 GW 득점", "GW points by position")}
      </h3>
      <p className="mb-2 text-caption text-[var(--muted)]">
        {tr(
          "포지션별로 선발 11명이 얻은 점수 합계입니다 (주장 2배 반영, 벤치·이적 차감 제외)",
          "Points earned by the starting 11 per position (captain doubled; bench and transfer cost excluded)"
        )}
      </p>
      <ul className="space-y-1.5">
        {COMPARE_POSITIONS.map((position) => (
          <li
            key={position}
            className="grid grid-cols-[2.5rem_minmax(0,1fr)_2.75rem_minmax(0,1fr)_2.5rem] items-center gap-1.5 text-caption tabular-nums md:grid-cols-[3rem_minmax(0,1fr)_3rem_minmax(0,1fr)_3rem]"
          >
            <span className="text-right font-semibold" style={{ color: "var(--chart-in)" }}>
              {pointsA[position]}{tr("점", " pts")}
            </span>
            <span className="flex h-3 justify-end overflow-hidden rounded-l-full bg-[var(--chart-mute-soft)]/50">
              <span className="h-full rounded-l-full" style={{ width: width(pointsA[position]), backgroundColor: "var(--chart-in)" }} />
            </span>
            <span className="text-center text-caption font-semibold text-[var(--muted)]">{position}</span>
            <span className="flex h-3 overflow-hidden rounded-r-full bg-[var(--chart-mute-soft)]/50">
              <span className="h-full rounded-r-full" style={{ width: width(pointsB[position]), backgroundColor: "var(--chart-out)" }} />
            </span>
            <span className="font-semibold" style={{ color: "var(--chart-out)" }}>
              {pointsB[position]}{tr("점", " pts")}
            </span>
          </li>
        ))}
        <li className="grid grid-cols-[2.5rem_minmax(0,1fr)_2.75rem_minmax(0,1fr)_2.5rem] items-center gap-1.5 border-t border-[var(--border)] pt-1.5 text-caption font-semibold tabular-nums md:grid-cols-[3rem_minmax(0,1fr)_3rem_minmax(0,1fr)_3rem]">
          <span className="text-right" style={{ color: "var(--chart-in)" }}>{totalA}{tr("점", " pts")}</span>
          <span />
          <span className="text-center text-caption text-[var(--muted)]">{tr("합계", "Total")}</span>
          <span />
          <span style={{ color: "var(--chart-out)" }}>{totalB}{tr("점", " pts")}</span>
        </li>
      </ul>
      <div className="mt-2 flex justify-between text-caption font-semibold">
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
    return <div className="py-2 text-center text-caption text-[var(--muted)]">-</div>;
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
  const { tr } = useLocale();
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
        aria-label={tr("스쿼드 비교", "Squad comparison")}
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-md border border-[var(--border)] bg-[var(--surface)] shadow-2xl md:max-w-3xl md:rounded-md"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-3 py-3 md:px-5">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold leading-6">{tr("스쿼드 비교", "Squad comparison")}</h2>
            <p className="text-caption text-[var(--muted)]">
              {tr(`공통 ${comparison.sharedCount}명`, `${comparison.sharedCount} shared`)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={tr("닫기", "Close")}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[var(--border)] bg-[var(--bg)] text-lg leading-none"
          >
            ×
          </button>
        </div>

        <div className="grid grid-cols-[repeat(3,minmax(0,1fr))] items-center gap-2 border-b border-[var(--border)] px-3 py-3 text-center md:px-5">
          <div className="min-w-0">
            <div className="text-xl font-semibold tabular-nums md:text-2xl">{a.gwPoints}</div>
            <div className="text-caption text-[var(--muted)]">{tr(`GW · 총 ${a.totalPoints}`, `GW · total ${a.totalPoints}`)}</div>
          </div>
          <div className="mx-auto">
            <SharedRing shared={comparison.sharedCount} total={15} />
          </div>
          <div className="min-w-0">
            <div className="text-xl font-semibold tabular-nums md:text-2xl">{b.gwPoints}</div>
            <div className="text-caption text-[var(--muted)]">{tr(`GW · 총 ${b.totalPoints}`, `GW · total ${b.totalPoints}`)}</div>
          </div>
        </div>

        <div className="grid grid-cols-[repeat(3,minmax(0,1fr))] gap-2 border-b border-[var(--border)] bg-[var(--surface-strong)]/40 px-3 py-2 text-center md:px-5">
          <div className="min-w-0">
            <div className="truncate text-meta font-semibold md:text-body">{a.teamName}</div>
            <div className="text-caption text-sky-700">{tr(`단독 보유 ${comparison.onlyACount}`, `Only ${comparison.onlyACount}`)}</div>
          </div>
          <div className="min-w-0">
            <div className="text-meta font-semibold md:text-body">{tr("공통", "Shared")}</div>
            <div className="text-caption text-emerald-700">{tr(`${comparison.sharedCount}명`, String(comparison.sharedCount))}</div>
          </div>
          <div className="min-w-0">
            <div className="truncate text-meta font-semibold md:text-body">{b.teamName}</div>
            <div className="text-caption text-rose-700">{tr(`단독 보유 ${comparison.onlyBCount}`, `Only ${comparison.onlyBCount}`)}</div>
          </div>
        </div>

        <div className="overflow-y-auto">
        <PositionBars a={a} b={b} />
        <div className="space-y-4 px-3 py-3 md:px-5 md:py-4">
          {comparison.positions.map((group) => (
            <section key={group.position}>
              <h3 className="mb-1.5 text-caption font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                {tr(positionLabel[group.position].ko, positionLabel[group.position].en)} ({group.position})
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
