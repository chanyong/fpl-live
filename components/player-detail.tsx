"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarSeries, LineSeries } from "@/components/charts/mini-series";
import { FdrStrip } from "@/components/fdr-strip";
import { RemoteImage } from "@/components/remote-image";
import { availability, averageDifficulty } from "@/lib/player-metrics";
import { formatMoney } from "@/lib/season-summary";
import type {
  LeaguePlayerStat,
  PlayerHistoryResponse,
  PlayerStat,
  TeamFixtureOutlook
} from "@/lib/types";

async function fetchHistory(elementId: number) {
  const response = await fetch(`/api/player-history?elementId=${elementId}`);

  if (!response.ok) {
    const payload = (await response.json()) as { error?: string };
    throw new Error(payload.error ?? "선수 기록을 불러오지 못했습니다.");
  }

  return (await response.json()) as PlayerHistoryResponse;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[0.7rem] border border-[var(--border)] bg-[var(--surface-strong)]/35 px-2.5 py-1.5">
      <div className="text-[10px] uppercase tracking-[0.08em] text-[var(--muted)]">{label}</div>
      <div className="text-[15px] font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function Panel({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[0.9rem] border border-[var(--border)] bg-[var(--surface)] p-3">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-[13px] font-semibold">{title}</h4>
        {hint ? <span className="text-[11px] text-[var(--muted)]">{hint}</span> : null}
      </div>
      {children}
    </section>
  );
}

export function PlayerDetail({
  player,
  fixtures,
  leagueStat,
  managerNames,
  onClose
}: {
  player: PlayerStat;
  fixtures: TeamFixtureOutlook[];
  leagueStat?: LeaguePlayerStat;
  managerNames: string[];
  onClose: () => void;
}) {
  const query = useQuery({
    queryKey: ["player-history", player.id],
    queryFn: () => fetchHistory(player.id),
    staleTime: 5 * 60_000
  });

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const health = availability(player.status);
  const history = query.data?.history ?? [];
  const owners = leagueStat?.owners.map((index) => managerNames[index] ?? "?") ?? [];

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/35 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`${player.webName} 상세`}
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-[720px] overflow-y-auto rounded-t-[1.2rem] border border-[var(--border)] bg-[var(--bg)] p-3 shadow-[0_-8px_40px_rgba(55,40,20,0.2)] sm:rounded-[1.2rem]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-start gap-3">
          <RemoteImage
            src={player.photoUrl}
            alt=""
            fallback={player.webName.slice(0, 2)}
            className="h-12 w-12 shrink-0 rounded-full border border-[var(--border)] bg-[var(--surface-strong)] object-cover"
            fallbackClassName="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface-strong)] text-[13px] font-semibold text-[var(--muted)]"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-2">
              <h3 className="text-[1.15rem] font-semibold">{player.webName}</h3>
              <span className="text-[12px] text-[var(--muted)]">
                {player.teamShortName} · {player.position} · {formatMoney(player.cost)}
              </span>
            </div>
            {player.status !== "a" ? (
              <p className="mt-0.5 text-[12px] text-[var(--danger)]">
                {health.label}
                {player.news ? ` · ${player.news}` : ""}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[var(--border)] px-2.5 py-1 text-[12px] text-[var(--muted)] transition hover:text-[var(--text)]"
          >
            닫기
          </button>
        </div>

        <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="GW 점수" value={String(player.eventPoints)} />
          <Stat label="누적 점수" value={String(player.totalPoints)} />
          <Stat label="폼" value={player.form.toFixed(1)} />
          <Stat label="전체 소유율" value={`${player.selectedByPercent}%`} />
        </div>

        {leagueStat ? (
          <div className="mb-3 rounded-[0.9rem] border border-[var(--border)] bg-[var(--surface)] p-3">
            <div className="text-[13px] font-semibold">
              리그 보유 {leagueStat.ownedBy}명 · EO {leagueStat.effectiveOwnership}%
            </div>
            <p className="mt-1 text-[12px] leading-relaxed text-[var(--muted)]">
              {owners.join(", ")}
              {leagueStat.captains.length > 0
                ? ` · 주장 ${leagueStat.captains.map((index) => managerNames[index] ?? "?").join(", ")}`
                : ""}
            </p>
          </div>
        ) : null}

        <div className="grid gap-2">
          <Panel
            title="다음 경기 난이도"
            hint={
              fixtures.length > 0
                ? `평균 ${averageDifficulty(fixtures)?.toFixed(1)} · 숫자가 클수록 어려움`
                : "숫자가 클수록 어려움"
            }
          >
            <FdrStrip fixtures={fixtures} />
          </Panel>

          {query.isLoading ? (
            <div className="h-[140px] animate-pulse rounded-[0.9rem] border border-[var(--border)] bg-[var(--surface)]/80" />
          ) : null}

          {query.error ? (
            <div className="rounded-[0.9rem] border border-red-200 bg-red-50 p-3 text-[13px] text-[var(--danger)]">
              {(query.error as Error).message}
            </div>
          ) : null}

          {query.data ? (
            <>
              <Panel title="게임위크별 획득 점수">
                <BarSeries points={history.map((row) => ({ label: `${row.gw}`, value: row.points }))} />
              </Panel>

              <Panel title="전체 소유자 수" hint="사람들이 이 선수를 얼마나 넣고 있나">
                <LineSeries
                  points={history.map((row) => ({ label: `${row.gw}`, value: row.selected }))}
                  format={(value) => `${Math.round(value / 1000).toLocaleString("ko-KR")}k`}
                />
              </Panel>

              <Panel title="주간 순이적" hint="영입 − 방출">
                <BarSeries
                  diverging
                  points={history.map((row) => ({ label: `${row.gw}`, value: row.transfersBalance }))}
                  format={(value) => `${Math.round(value / 1000)}k`}
                />
              </Panel>

              <Panel title="가격 추이">
                <LineSeries
                  points={history.map((row) => ({ label: `${row.gw}`, value: row.value }))}
                  format={(value) => formatMoney(value)}
                />
              </Panel>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
