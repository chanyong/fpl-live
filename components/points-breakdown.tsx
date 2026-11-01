"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { pointsLabel, pointsValueLabel } from "@/lib/player-metrics";
import type { PlayerPointsFixture, PlayerPointsResponse } from "@/lib/types";
import { useLocale } from "@/components/locale-provider";

async function fetchPoints(elementId: number, gw: number, fallbackError: string) {
  const response = await fetch(`/api/player-points?elementId=${elementId}&gw=${gw}`);

  if (!response.ok) {
    const payload = (await response.json()) as { error?: string };
    throw new Error(payload.error ?? fallbackError);
  }

  return (await response.json()) as PlayerPointsResponse;
}

function Points({ value }: { value: number }) {
  const tone = value < 0 ? "text-[var(--danger)]" : value > 0 ? "text-[var(--text)]" : "text-[var(--muted)]";

  return (
    <span className={`tabular-nums font-semibold ${tone}`}>
      {value > 0 ? "+" : ""}
      {value}
    </span>
  );
}

function FixtureLedger({ fixture }: { fixture: PlayerPointsFixture }) {
  const { tr, locale } = useLocale();
  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--bg)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-2.5 py-1.5">
        <span className="text-caption font-semibold">
          {fixture.home ? "vs" : "@"} {fixture.opponent}
          <span className="ml-1.5 font-normal text-[var(--muted)]">
            {tr(`${fixture.minutes}분`, `${fixture.minutes} min`)}
          </span>
        </span>
        <span className="text-caption text-[var(--muted)]">
          {fixture.settled
            ? tr("종료", "Finished")
            : fixture.started
              ? tr("진행 중", "Live")
              : tr("경기 전", "Not started")}
        </span>
      </div>

      <table className="w-full border-collapse text-meta">
        <tbody>
          {fixture.lines.map((line) => (
            <tr key={line.identifier} className="border-b border-dashed border-[var(--border)]">
              <td className="px-2.5 py-1.5">{pointsLabel(line.identifier, locale)}</td>
              <td className="px-2.5 py-1.5 text-right tabular-nums text-[var(--muted)]">
                {pointsValueLabel(line.identifier, line.value, locale)}
              </td>
              <td className="w-14 px-2.5 py-1.5 text-right">
                <Points value={line.points} />
              </td>
            </tr>
          ))}

          {fixture.provisionalBonus > 0 ? (
            <tr className="border-b border-dashed border-[var(--border)]">
              <td className="px-2.5 py-1.5">
                {tr("보너스", "Bonus")}
                <span className="ml-1.5 rounded-md bg-[var(--accent-soft)] px-1.5 text-caption font-semibold text-[var(--accent)]">
                  {tr("잠정", "Provisional")}
                </span>
              </td>
              <td className="px-2.5 py-1.5 text-right tabular-nums text-[var(--muted)]">
                {tr("BPS 예상", "Projected from BPS")}
              </td>
              <td className="px-2.5 py-1.5 text-right">
                <Points value={fixture.provisionalBonus} />
              </td>
            </tr>
          ) : null}

          {fixture.lines.length === 0 && fixture.provisionalBonus === 0 ? (
            <tr>
              <td colSpan={3} className="px-2.5 py-3 text-center text-caption text-[var(--muted)]">
                {tr("아직 기록된 득점 항목이 없습니다.", "No scoring events yet.")}
              </td>
            </tr>
          ) : null}

          <tr className="bg-[var(--surface-strong)]/40">
            <td className="px-2.5 py-1.5 text-caption font-semibold" colSpan={2}>
              {tr("소계", "Subtotal")}
            </td>
            <td className="px-2.5 py-1.5 text-right">
              <Points value={fixture.points} />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/**
 * The ledger behind a player's gameweek score.
 *
 * `multiplier` is the manager's, not the player's: it says nothing about how the score was
 * earned, so it is applied once at the bottom rather than smeared through every line.
 */
export function PointsBreakdown({
  elementId,
  gw,
  multiplier = 1
}: {
  elementId: number;
  gw: number;
  multiplier?: number;
}) {
  const { tr, locale } = useLocale();
  const query = useQuery({
    queryKey: ["player-points", elementId, gw],
    queryFn: () => fetchPoints(elementId, gw, tr("득점 내역을 불러오지 못했습니다.", "Could not load the points breakdown.")),
    staleTime: 30_000
  });

  if (query.isLoading) {
    return <div className="h-[160px] animate-pulse rounded-md bg-[var(--surface-strong)]/50" />;
  }

  if (query.error) {
    return (
      <p className="rounded-md border border-red-200 bg-red-50 p-3 text-meta text-[var(--danger)]">
        {(query.error as Error).message}
      </p>
    );
  }

  const data = query.data;
  if (!data) {
    return null;
  }

  if (data.fixtures.length === 0) {
    return (
      <p className="py-4 text-center text-meta text-[var(--muted)]">
        {tr(`GW${data.gw}에 이 선수의 경기가 없습니다.`, `No fixtures for this player in GW${data.gw}.`)}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-2">
        {data.fixtures.map((fixture) => (
          <FixtureLedger key={fixture.fixtureId} fixture={fixture} />
        ))}
      </div>

      <div className="rounded-md border border-[var(--border)] bg-[var(--surface-strong)]/50 px-2.5 py-2">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-meta font-semibold">{tr(`GW${data.gw} 합계`, `GW${data.gw} total`)}</span>
          <span className="text-title font-semibold tabular-nums">
            {data.points}
            {tr("점", " pts")}
          </span>
        </div>
        {multiplier > 1 ? (
          <div className="mt-1 flex items-baseline justify-between gap-2 border-t border-[var(--border)] pt-1">
            <span className="text-caption text-[var(--muted)]">
              {multiplier === 3
                ? tr("트리플 캡틴 ×3 적용", "Triple Captain ×3 applied")
                : tr("주장 ×2 적용", "Captain ×2 applied")}
            </span>
            <span className="text-body-lg font-semibold tabular-nums">
              {data.points * multiplier}
              {tr("점", " pts")}
            </span>
          </div>
        ) : null}
        {data.provisionalBonus > 0 ? (
          <p className="mt-1 text-caption leading-relaxed text-[var(--muted)]">
            {tr(`보너스 ${data.provisionalBonus}점은 BPS 예상(잠정). 경기 후 확정됩니다.`, `${data.provisionalBonus} bonus pts are projected from BPS; final after the match.`)}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/** The same ledger as a dialog, for the squad cards that have no detail sheet of their own. */
export function PointsBreakdownModal({
  elementId,
  gw,
  webName,
  teamShortName,
  multiplier = 1,
  onClose
}: {
  elementId: number;
  gw: number;
  webName: string;
  teamShortName: string;
  multiplier?: number;
  onClose: () => void;
}) {
  const { tr } = useLocale();
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/35 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={tr(`${webName} 득점 상세`, `${webName} points breakdown`)}
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-[440px] overflow-y-auto rounded-t-md border border-[var(--border)] bg-[var(--bg)] p-3 shadow-[0_-8px_40px_rgba(55,40,20,0.2)] sm:rounded-md"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-2.5 flex items-start justify-between gap-2">
          <div>
            <h3 className="text-title font-semibold">{webName}</h3>
            <p className="text-caption text-[var(--muted)]">{teamShortName} · {tr("득점 상세", "Points breakdown")}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-[var(--border)] px-2.5 py-1 text-caption text-[var(--muted)] transition hover:text-[var(--text)]"
          >
            {tr("닫기", "Close")}
          </button>
        </div>

        <PointsBreakdown elementId={elementId} gw={gw} multiplier={multiplier} />
      </div>
    </div>
  );
}
