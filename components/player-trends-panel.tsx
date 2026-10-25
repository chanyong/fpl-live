"use client";

import { useMemo, useState } from "react";
import { KpiCard, KpiGrid } from "@/components/kpi-card";
import { SidePanelLayout } from "@/components/side-panel-layout";
import { DivergingRows, type BarRow } from "@/components/charts/bar-rows";
import { FormScatter } from "@/components/charts/form-scatter";
import { DifferentialList } from "@/components/differential-list";
import { LeaguePlayersPanel } from "@/components/league-players-panel";
import { PlayerDetail } from "@/components/player-detail";
import { PlayerTable } from "@/components/player-table";
import { PriceChangesSection } from "@/components/price-changes-section";
import { DIFFERENTIAL_MIN_MINUTES, selectDifferentials } from "@/lib/player-metrics";
import type { FplPosition, PlayerStatsResponse } from "@/lib/types";
import { useLocale } from "@/components/locale-provider";

/** A differential is a player this much of the world owns, or less. */
const OWNERSHIP_CUT = 10;
/** …while scoring at least this. */
const FORM_CUT = 6;

const compact = new Intl.NumberFormat("ko-KR", { notation: "compact", maximumFractionDigits: 1 });
const full = new Intl.NumberFormat("ko-KR");

type PositionFilter = "ALL" | FplPosition;

const POSITION_FILTERS: Array<{ id: PositionFilter; ko: string; en: string }> = [
  { id: "ALL", ko: "전체", en: "All" },
  { id: "GKP", ko: "GKP", en: "GKP" },
  { id: "DEF", ko: "DEF", en: "DEF" },
  { id: "MID", ko: "MID", en: "MID" },
  { id: "FWD", ko: "FWD", en: "FWD" }
];

/** Price moves are announced once FPL's own progress meter is this close to 100%. */
const PRICE_SOON_CUT = 90;

type View = "transfers" | "performance" | "league";

const VIEWS: Array<{ id: View; ko: string; en: string }> = [
  { id: "transfers", ko: "이적 시장", en: "Transfers" },
  { id: "performance", ko: "선수 성과", en: "Performance" },
  { id: "league", ko: "우리 리그", en: "Our league" }
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
  const { tr } = useLocale();
  const [view, setView] = useState<View>("transfers");
  const [selected, setSelected] = useState<number | null>(null);
  const [position, setPosition] = useState<PositionFilter>("ALL");

  // One position filter drives every view, so the chart, the list and the table never disagree.
  const players = useMemo(
    () => (position === "ALL" ? data.players : data.players.filter((player) => player.position === position)),
    [data.players, position]
  );
  const leaguePlayers = useMemo(
    () =>
      position === "ALL"
        ? data.leaguePlayers
        : data.leaguePlayers.filter((player) => player.position === position),
    [data.leaguePlayers, position]
  );

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
    const byNet = [...players].sort((left, right) => right.netTransfers - left.netTransfers);
    const movers = [...byNet.slice(0, 6), ...byNet.slice(-4).reverse()];

    return movers.map((player) => ({
      key: player.id,
      label: player.webName,
      sub: player.teamShortName,
      left: player.transfersOutEvent,
      right: player.transfersInEvent,
      value: `${player.netTransfers >= 0 ? "+" : "−"}${compact.format(Math.abs(player.netTransfers))}`,
      tooltip: tr(
        `${player.webName} · 영입 ${full.format(player.transfersInEvent)} / 방출 ${full.format(player.transfersOutEvent)}`,
        `${player.webName} · in ${full.format(player.transfersInEvent)} / out ${full.format(player.transfersOutEvent)}`
      ),
      onSelect: () => setSelected(player.id)
    }));
  }, [players, tr]);

  const transferMax = useMemo(
    () =>
      Math.max(
        1,
        ...transferRows.map((row) => Math.max(row.right, row.left ?? 0))
      ),
    [transferRows]
  );

  const differentials = useMemo(
    () => selectDifferentials(players, { ownershipCut: OWNERSHIP_CUT, formCut: FORM_CUT }),
    [players]
  );

  const topHeld = useMemo(
    () => leaguePlayers.reduce<(typeof leaguePlayers)[number] | null>(
      (best, row) => (best === null || row.ownedBy > best.ownedBy ? row : best),
      null
    ),
    [leaguePlayers]
  );
  const priceSoon = useMemo(
    () => players.filter((player) => Math.abs(player.priceChangePercent) >= PRICE_SOON_CUT).length,
    [players]
  );

  const transferWindowLabel = data.league.nextGw
    ? tr(`GW${data.league.nextGw} 데드라인 대비`, `Towards the GW${data.league.nextGw} deadline`)
    : tr(`GW${data.league.currentGw} 기준`, `As of GW${data.league.currentGw}`);

  const selectedPlayer = selected !== null ? playersById.get(selected) : undefined;

  return (
    <SidePanelLayout
      side={
      <KpiGrid label={tr("선수 요약", "Player summary")} columns={3}>
        <KpiCard
          label={tr("리그 최다 보유", "Most owned in league")}
          value={topHeld?.webName ?? "-"}
          sub={
            topHeld
              ? tr(`${topHeld.ownedBy}명 보유 · ${topHeld.leaguePercent}%`, `${topHeld.ownedBy} own · ${topHeld.leaguePercent}%`)
              : tr("보유 선수 없음", "No owned players")
          }
        />
        <KpiCard
          label={tr("가격 변동 임박", "Price change due")}
          value={tr(`${priceSoon}명`, String(priceSoon))}
          sub={tr(`진행률 ${PRICE_SOON_CUT}% 이상`, `${PRICE_SOON_CUT}%+ progress`)}
        />
        <KpiCard
          label={tr("차별화 후보", "Differentials")}
          value={tr(`${differentials.length}명`, String(differentials.length))}
          sub={tr(`소유율 ${OWNERSHIP_CUT}% 이하 · 폼 ${FORM_CUT}+`, `≤${OWNERSHIP_CUT}% owned · form ${FORM_CUT}+`)}
        />
      </KpiGrid>
      }
    >
    <div className="flex flex-col gap-2">
      <div
        role="tablist"
        aria-label={tr("선수 데이터 보기", "Player data views")}
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
                active ? "bg-[var(--accent-soft)] text-[var(--accent-ink)] shadow-[inset_0_0_0_1px_var(--accent)]" : "text-[var(--muted)] hover:text-[var(--text)]"
              }`}
            >
              {tr(item.ko, item.en)}
            </button>
          );
        })}
      </div>

      <div role="group" aria-label={tr("포지션 필터", "Position filter")} className="flex flex-wrap gap-1.5">
        {POSITION_FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={position === item.id}
            onClick={() => setPosition(item.id)}
            className={`min-h-9 shrink-0 rounded-full border px-3.5 text-[13px] font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
              position === item.id
                ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-ink)]"
                : "border-[var(--border)] bg-white text-[var(--muted)] hover:border-[var(--accent)]"
            }`}
          >
            {tr(item.ko, item.en)}
          </button>
        ))}
      </div>

      {view === "transfers" ? (
        <>
          <Section
            title={tr("영입과 방출", "Transfers in and out")}
            hint={tr(
              `${transferWindowLabel} 이적 수치입니다. 이 값은 데드라인마다 0으로 초기화됩니다.`,
              `Transfer figures ${transferWindowLabel}. They reset to 0 at every deadline.`
            )}
          >
            <div className="mb-2 flex flex-wrap gap-3 text-[11px] text-[var(--muted)]">
              <span className="flex items-center gap-1.5">
                <i className="h-[11px] w-[11px] rounded-[3px]" style={{ background: "var(--chart-in)" }} />
                {tr("영입", "In")}
              </span>
              <span className="flex items-center gap-1.5">
                <i className="h-[11px] w-[11px] rounded-[3px]" style={{ background: "var(--chart-out)" }} />
                {tr("방출", "Out")}
              </span>
              <span>{tr("오른쪽 숫자 = 순이동", "Right-hand number = net moves")}</span>
            </div>
            <div className="overflow-x-auto">
              <DivergingRows
                rows={transferRows}
                max={transferMax}
                scale={{ left: tr("← 방출", "← Out"), mid: "0", right: tr("영입 →", "In →") }}
              />
            </div>
          </Section>

          <PriceChangesSection onSelect={setSelected} />
        </>
      ) : null}

      {view === "performance" ? (
        <>
          <Section
            title={tr("폼 × 소유율", "Form × ownership")}
            hint={tr(
              `소유율 ${OWNERSHIP_CUT}% 이하이면서 폼 ${FORM_CUT} 이상인 선수를 강조했습니다. 테두리가 진한 점은 우리 리그가 이미 보유한 선수입니다. 점을 누르면 상세가 열립니다.`,
              `Players owned by ${OWNERSHIP_CUT}% or less with form ${FORM_CUT}+ are highlighted. Dots with a dark outline are already owned in our league. Tap a dot for details.`
            )}
          >
            <div className="overflow-x-auto">
              <div className="min-w-[540px]">
                <FormScatter
                  players={players}
                  ownershipCut={OWNERSHIP_CUT}
                  formCut={FORM_CUT}
                  ownedIds={ownedIds}
                  onSelect={setSelected}
                />
              </div>
            </div>
          </Section>

          <Section
            title={tr(`차별화 후보 ${differentials.length}명`, `Differentials: ${differentials.length}`)}
            hint={tr(
              `소유율 ${OWNERSHIP_CUT}% 이하, 폼 ${FORM_CUT} 이상, ${DIFFERENTIAL_MIN_MINUTES}분 이상 출전. 위 산점도에서 강조된 선수와 같은 목록입니다.`,
              `Owned by ${OWNERSHIP_CUT}% or less, form ${FORM_CUT}+, ${DIFFERENTIAL_MIN_MINUTES}+ minutes played. The same list as the highlighted dots above.`
            )}
          >
            <DifferentialList
              players={differentials}
              fdr={data.fdr}
              ownedIds={ownedIds}
              onSelect={setSelected}
            />
          </Section>

          <PlayerTable players={players} fdr={data.fdr} ownedIds={ownedIds} onSelect={setSelected} />
        </>
      ) : null}

      {view === "league" ? (
        <LeaguePlayersPanel
          leaguePlayers={leaguePlayers}
          managerNames={managerNames}
          onSelect={setSelected}
        />
      ) : null}

      {selectedPlayer ? (
        <PlayerDetail
          player={selectedPlayer}
          gw={data.league.currentGw}
          fixtures={data.fdr[selectedPlayer.teamShortName] ?? []}
          leagueStat={leagueById.get(selectedPlayer.id)}
          managerNames={managerNames}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </div>
    </SidePanelLayout>
  );
}
