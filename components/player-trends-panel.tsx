"use client";

import { useMemo, useState } from "react";
import { DivergingRows, type BarRow } from "@/components/charts/bar-rows";
import { FormScatter } from "@/components/charts/form-scatter";
import { DifferentialList } from "@/components/differential-list";
import { LeaguePlayersPanel } from "@/components/league-players-panel";
import { PlayerDetail } from "@/components/player-detail";
import { PlayerTable } from "@/components/player-table";
import { DIFFERENTIAL_MIN_MINUTES, selectDifferentials } from "@/lib/player-metrics";
import type { PlayerStatsResponse } from "@/lib/types";

/** A differential is a player this much of the world owns, or less. */
const OWNERSHIP_CUT = 10;
/** …while scoring at least this. */
const FORM_CUT = 6;

const compact = new Intl.NumberFormat("ko-KR", { notation: "compact", maximumFractionDigits: 1 });
const full = new Intl.NumberFormat("ko-KR");

type View = "transfers" | "performance" | "league";

const VIEWS: Array<{ id: View; label: string }> = [
  { id: "transfers", label: "이적 시장" },
  { id: "performance", label: "선수 성과" },
  { id: "league", label: "우리 리그" }
];

function Section({
  title,
  hint,
  children
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[1.2rem] border border-[var(--border)] bg-[var(--surface)] p-3 shadow-[0_12px_36px_rgba(55,40,20,0.07)]">
      <div className="mb-2">
        <h3 className="text-[1rem] font-semibold">{title}</h3>
        {hint ? <p className="text-[12px] leading-relaxed text-[var(--muted)]">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function PlayerTrendsPanel({ data }: { data: PlayerStatsResponse }) {
  const [view, setView] = useState<View>("transfers");
  const [selected, setSelected] = useState<number | null>(null);

  const managerNames = useMemo(() => data.managers.map((manager) => manager.managerName), [data.managers]);
  const ownedIds = useMemo(
    () => new Set(data.leaguePlayers.map((row) => row.elementId)),
    [data.leaguePlayers]
  );
  const playersById = useMemo(() => new Map(data.players.map((player) => [player.id, player])), [data.players]);
  const leagueById = useMemo(
    () => new Map(data.leaguePlayers.map((row) => [row.elementId, row])),
    [data.leaguePlayers]
  );

  const transferRows: BarRow[] = useMemo(() => {
    const byNet = [...data.players].sort((left, right) => right.netTransfers - left.netTransfers);
    const movers = [...byNet.slice(0, 6), ...byNet.slice(-4).reverse()];

    return movers.map((player) => ({
      key: player.id,
      label: player.webName,
      sub: player.teamShortName,
      left: player.transfersOutEvent,
      right: player.transfersInEvent,
      value: `${player.netTransfers >= 0 ? "+" : "−"}${compact.format(Math.abs(player.netTransfers))}`,
      tooltip: `${player.webName} · 영입 ${full.format(player.transfersInEvent)} / 방출 ${full.format(player.transfersOutEvent)}`,
      onSelect: () => setSelected(player.id)
    }));
  }, [data.players]);

  const transferMax = useMemo(
    () =>
      Math.max(
        1,
        ...transferRows.map((row) => Math.max(row.right, row.left ?? 0))
      ),
    [transferRows]
  );

  const priceRows: BarRow[] = useMemo(() => {
    const risers = [...data.players]
      .filter((player) => player.priceChangePercent > 0)
      .sort((left, right) => right.priceChangePercent - left.priceChangePercent)
      .slice(0, 5);
    const fallers = [...data.players]
      .filter((player) => player.priceChangePercent < 0)
      .sort((left, right) => left.priceChangePercent - right.priceChangePercent)
      .slice(0, 4);

    return [...risers, ...fallers].map((player) => {
      const rising = player.priceChangePercent >= 0;

      return {
        key: player.id,
        label: player.webName,
        sub: player.teamShortName,
        left: rising ? 0 : Math.abs(player.priceChangePercent),
        right: rising ? player.priceChangePercent : 0,
        value: `${rising ? "상승" : "하락"} ${Math.abs(player.priceChangePercent).toFixed(0)}%`,
        tooltip: `${player.webName} · 가격 ${rising ? "상승" : "하락"}까지 ${Math.abs(player.priceChangePercent).toFixed(1)}%`,
        onSelect: () => setSelected(player.id)
      };
    });
  }, [data.players]);

  const differentials = useMemo(
    () => selectDifferentials(data.players, { ownershipCut: OWNERSHIP_CUT, formCut: FORM_CUT }),
    [data.players]
  );

  const transferWindowLabel = data.league.nextGw
    ? `GW${data.league.nextGw} 데드라인 대비`
    : `GW${data.league.currentGw} 기준`;

  const selectedPlayer = selected !== null ? playersById.get(selected) : undefined;

  return (
    <div className="flex flex-col gap-3">
      <div
        role="tablist"
        aria-label="선수 데이터 보기"
        className="inline-flex w-full rounded-[0.9rem] border border-[var(--border)] bg-[var(--surface)] p-1 md:w-auto"
      >
        {VIEWS.map((item) => {
          const active = view === item.id;

          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setView(item.id)}
              className={`flex-1 rounded-[0.7rem] px-3 py-1.5 text-[13px] font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] md:flex-none ${
                active ? "bg-[var(--text)] text-white" : "text-[var(--muted)] hover:text-[var(--text)]"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {view === "transfers" ? (
        <>
          <Section
            title="영입과 방출"
            hint={`${transferWindowLabel} 이적 수치입니다. 이 값은 데드라인마다 0으로 초기화됩니다.`}
          >
            <div className="mb-2 flex flex-wrap gap-3 text-[11px] text-[var(--muted)]">
              <span className="flex items-center gap-1.5">
                <i className="h-[11px] w-[11px] rounded-[3px]" style={{ background: "var(--chart-in)" }} />
                영입
              </span>
              <span className="flex items-center gap-1.5">
                <i className="h-[11px] w-[11px] rounded-[3px]" style={{ background: "var(--chart-out)" }} />
                방출
              </span>
              <span>오른쪽 숫자 = 순이동</span>
            </div>
            <div className="overflow-x-auto">
              <DivergingRows
                rows={transferRows}
                max={transferMax}
                scale={{ left: "← 방출", mid: "0", right: "영입 →" }}
              />
            </div>
          </Section>

          {priceRows.length > 0 ? (
            <Section
              title="가격 변동 임박"
              hint="FPL이 직접 제공하는 변동 진행률입니다. 100%에 닿으면 다음 갱신에서 가격이 움직입니다."
            >
              <div className="overflow-x-auto">
                <DivergingRows
                  rows={priceRows}
                  max={100}
                  valueWidth="84px"
                  scale={{ left: "← 하락 임박", mid: "0", right: "상승 임박 →" }}
                />
              </div>
            </Section>
          ) : null}
        </>
      ) : null}

      {view === "performance" ? (
        <>
          <Section
            title="폼 × 소유율"
            hint={`소유율 ${OWNERSHIP_CUT}% 이하이면서 폼 ${FORM_CUT} 이상인 선수를 강조했습니다. 테두리가 진한 점은 우리 리그가 이미 보유한 선수입니다. 점을 누르면 상세가 열립니다.`}
          >
            <div className="overflow-x-auto">
              <div className="min-w-[540px]">
                <FormScatter
                  players={data.players}
                  ownershipCut={OWNERSHIP_CUT}
                  formCut={FORM_CUT}
                  ownedIds={ownedIds}
                  onSelect={setSelected}
                />
              </div>
            </div>
          </Section>

          <Section
            title={`차별화 후보 ${differentials.length}명`}
            hint={`소유율 ${OWNERSHIP_CUT}% 이하, 폼 ${FORM_CUT} 이상, ${DIFFERENTIAL_MIN_MINUTES}분 이상 출전. 위 산점도에서 강조된 선수와 같은 목록입니다.`}
          >
            <DifferentialList
              players={differentials}
              fdr={data.fdr}
              ownedIds={ownedIds}
              onSelect={setSelected}
            />
          </Section>

          <PlayerTable players={data.players} fdr={data.fdr} ownedIds={ownedIds} onSelect={setSelected} />
        </>
      ) : null}

      {view === "league" ? (
        <LeaguePlayersPanel
          leaguePlayers={data.leaguePlayers}
          managerNames={managerNames}
          onSelect={setSelected}
        />
      ) : null}

      {selectedPlayer ? (
        <PlayerDetail
          player={selectedPlayer}
          fixtures={data.fdr[selectedPlayer.teamShortName] ?? []}
          leagueStat={leagueById.get(selectedPlayer.id)}
          managerNames={managerNames}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </div>
  );
}
