"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { pointsValueLabel } from "@/lib/player-metrics";
import type { PlayerPointsFixture, PlayerPointsResponse } from "@/lib/types";

async function fetchPoints(elementId: number, gw: number) {
  const response = await fetch(`/api/player-points?elementId=${elementId}&gw=${gw}`);

  if (!response.ok) {
    const payload = (await response.json()) as { error?: string };
    throw new Error(payload.error ?? "득점 내역을 불러오지 못했습니다.");
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
  return (
    <div className="rounded-[0.7rem] border border-[var(--border)] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-2.5 py-1.5">
        <span className="text-[12px] font-semibold">
          {fixture.home ? "vs" : "@"} {fixture.opponent}
          <span className="ml-1.5 font-normal text-[var(--muted)]">{fixture.minutes}분</span>
        </span>
        <span className="text-[11px] text-[var(--muted)]">
          {fixture.settled ? "종료" : fixture.started ? "진행 중" : "경기 전"}
        </span>
      </div>

      <table className="w-full border-collapse text-[13px]">
        <tbody>
          {fixture.lines.map((line) => (
            <tr key={line.identifier} className="border-b border-dashed border-[var(--border)]">
              <td className="px-2.5 py-1.5">{line.label}</td>
              <td className="px-2.5 py-1.5 text-right tabular-nums text-[var(--muted)]">
                {pointsValueLabel(line.identifier, line.value)}
              </td>
              <td className="w-14 px-2.5 py-1.5 text-right">
                <Points value={line.points} />
              </td>
            </tr>
          ))}

          {fixture.provisionalBonus > 0 ? (
            <tr className="border-b border-dashed border-[var(--border)]">
              <td className="px-2.5 py-1.5">
                보너스
                <span className="ml-1.5 rounded-full bg-[var(--accent-soft)] px-1.5 text-[10px] font-semibold text-[var(--accent)]">
                  잠정
                </span>
              </td>
              <td className="px-2.5 py-1.5 text-right tabular-nums text-[var(--muted)]">BPS 예상</td>
              <td className="px-2.5 py-1.5 text-right">
                <Points value={fixture.provisionalBonus} />
              </td>
            </tr>
          ) : null}

          {fixture.lines.length === 0 && fixture.provisionalBonus === 0 ? (
            <tr>
              <td colSpan={3} className="px-2.5 py-3 text-center text-[12px] text-[var(--muted)]">
                아직 기록된 득점 항목이 없습니다.
              </td>
            </tr>
          ) : null}

          <tr className="bg-[var(--surface-strong)]/40">
            <td className="px-2.5 py-1.5 text-[12px] font-semibold" colSpan={2}>
              소계
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
  const query = useQuery({
    queryKey: ["player-points", elementId, gw],
    queryFn: () => fetchPoints(elementId, gw),
    staleTime: 30_000
  });

  if (query.isLoading) {
    return <div className="h-[160px] animate-pulse rounded-[0.7rem] bg-[var(--surface-strong)]/50" />;
  }

  if (query.error) {
    return (
      <p className="rounded-[0.7rem] border border-red-200 bg-red-50 p-3 text-[13px] text-[var(--danger)]">
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
      <p className="py-4 text-center text-[13px] text-[var(--muted)]">
        GW{data.gw}에 이 선수의 경기가 없습니다.
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

      <div className="rounded-[0.7rem] border border-[var(--border)] bg-[var(--surface-strong)]/50 px-2.5 py-2">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[13px] font-semibold">GW{data.gw} 합계</span>
          <span className="text-[17px] font-semibold tabular-nums">{data.points}점</span>
        </div>
        {multiplier > 1 ? (
          <div className="mt-1 flex items-baseline justify-between gap-2 border-t border-[var(--border)] pt-1">
            <span className="text-[12px] text-[var(--muted)]">
              {multiplier === 3 ? "트리플 캡틴 ×3" : "주장 ×2"} 적용
            </span>
            <span className="text-[15px] font-semibold tabular-nums">{data.points * multiplier}점</span>
          </div>
        ) : null}
        {data.provisionalBonus > 0 ? (
          <p className="mt-1 text-[11px] leading-relaxed text-[var(--muted)]">
            보너스 {data.provisionalBonus}점은 현재 BPS 순위로 예상한 잠정 점수입니다. 경기가 끝나고 FPL이
            보너스를 확정하면 그 값으로 바뀝니다.
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
      aria-label={`${webName} 득점 상세`}
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-[440px] overflow-y-auto rounded-t-[1.2rem] border border-[var(--border)] bg-[var(--bg)] p-3 shadow-[0_-8px_40px_rgba(55,40,20,0.2)] sm:rounded-[1.2rem]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-2.5 flex items-start justify-between gap-2">
          <div>
            <h3 className="text-[1.05rem] font-semibold">{webName}</h3>
            <p className="text-[12px] text-[var(--muted)]">{teamShortName} · 득점 상세</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[var(--border)] px-2.5 py-1 text-[12px] text-[var(--muted)] transition hover:text-[var(--text)]"
          >
            닫기
          </button>
        </div>

        <PointsBreakdown elementId={elementId} gw={gw} multiplier={multiplier} />
      </div>
    </div>
  );
}
