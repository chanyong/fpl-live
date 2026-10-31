"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  PRICE_STATUS_ORDER,
  daysUntilUnlock,
  matchesDirection,
  ownershipTrend,
  priceStatus,
  selectPricePredictions,
  selectRecentPriceChanges,
  type PriceDirection,
  type PriceStatus
} from "@/lib/price-changes";
import { formatMoney } from "@/lib/season-summary";
import type { FplPosition, PlayerStat, PriceChangeEvent, PriceChangesResponse } from "@/lib/types";
import { useLocale } from "@/components/locale-provider";

type PredictionKey = "progress" | "projected" | "status" | "ownership" | "cost";
type HistoryKey = "date" | "change" | "before" | "after";
type SortDir = "desc" | "asc";
type PositionFilter = "all" | FplPosition;

const PAGE_SIZE = 20;
const POSITIONS: FplPosition[] = ["GKP", "DEF", "MID", "FWD"];

/** Same five-step scale as the official chips: strong green → neutral → strong red. */
const STATUS_STYLE: Record<PriceStatus, string> = {
  "very-likely-rise": "bg-[var(--accent)] text-white",
  "likely-rise": "bg-[#b9e6d2] text-[var(--accent-ink)]",
  "no-change": "bg-[#ece8df] text-[var(--muted)]",
  "likely-drop": "bg-[#f4c7c2] text-[#7a1f1f]",
  "very-likely-drop": "bg-[var(--danger)] text-white"
};

/** Higher = stronger rise; used when sorting by the status column. */
const STATUS_RANK: Record<PriceStatus, number> = Object.fromEntries(
  PRICE_STATUS_ORDER.map((status, index) => [status, PRICE_STATUS_ORDER.length - index])
) as Record<PriceStatus, number>;

async function fetchPriceChanges(fallbackError: string) {
  const response = await fetch("/api/price-changes");

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? fallbackError);
  }

  return (await response.json()) as PriceChangesResponse;
}

function signed(value: number) {
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function money(tenths: number) {
  return `£${(tenths / 10).toFixed(1)}m`;
}

function predictionValue(player: PlayerStat, key: PredictionKey) {
  switch (key) {
    case "progress":
      return player.priceChangePercent;
    case "projected":
      return player.projectedPercent;
    case "status":
      return STATUS_RANK[priceStatus(player.priceLikelihood)];
    case "ownership":
      return player.netTransfers;
    case "cost":
      return player.cost;
  }
}

function historyValue(change: PriceChangeEvent, key: HistoryKey) {
  switch (key) {
    case "date":
      return new Date(change.changedAt).getTime();
    case "change":
      return change.costAfter - change.costBefore;
    case "before":
      return change.costBefore;
    case "after":
      return change.costAfter;
  }
}

/** First click sorts high to low, a second flips it, a third returns to the official order. */
function useSort<K extends string>() {
  const [sort, setSort] = useState<{ key: K; dir: SortDir } | null>(null);

  function toggle(key: K) {
    setSort((current) => {
      if (!current || current.key !== key) {
        return { key, dir: "desc" };
      }
      return current.dir === "desc" ? { key, dir: "asc" } : null;
    });
  }

  return { sort, toggle };
}

function applySort<T, K extends string>(rows: T[], sort: { key: K; dir: SortDir } | null, value: (row: T, key: K) => number) {
  if (!sort) {
    return rows;
  }

  const factor = sort.dir === "desc" ? -1 : 1;
  return [...rows].sort((left, right) => factor * (value(left, sort.key) - value(right, sort.key)));
}

function SortHeader({
  label,
  active,
  dir,
  onSort,
  align = "left"
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onSort: () => void;
  align?: "left" | "right";
}) {
  return (
    <button
      type="button"
      onClick={onSort}
      className={`inline-flex items-center gap-1 rounded-md px-1 py-0.5 font-semibold uppercase tracking-wide transition hover:text-[var(--accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
        active ? "text-[var(--accent-ink)]" : ""
      } ${align === "right" ? "flex-row-reverse" : ""}`}
    >
      {label}
      <span aria-hidden="true" className={active ? "" : "opacity-30"}>
        {active ? (dir === "desc" ? "▼" : "▲") : "⇅"}
      </span>
    </button>
  );
}

/** Red for out, amber for doubtful — the warning FPL puts beside a player's name. */
function AvailabilityMark({ status, news }: { status: string; news: string }) {
  if (status === "a") {
    return null;
  }

  return (
    <span
      title={news || undefined}
      aria-label={news || undefined}
      className={`mr-1 text-caption ${status === "d" ? "text-[var(--warning)]" : "text-[var(--danger)]"}`}
    >
      ▲!
    </span>
  );
}

function PlayerCell({
  id,
  webName,
  teamShortName,
  position,
  onSelect,
  mark
}: {
  id: number;
  webName: string;
  teamShortName: string;
  position: string;
  onSelect: (id: number) => void;
  mark?: ReactNode;
}) {
  return (
    <td className="border-t border-[var(--border)] py-1.5 pr-2">
      {mark}
      <button
        type="button"
        onClick={() => onSelect(id)}
        className="text-left font-semibold underline-offset-4 hover:text-[var(--accent)] hover:underline"
      >
        {webName}
      </button>
      <span className="ml-1.5 text-caption text-[var(--muted)]">
        {teamShortName} · {position}
      </span>
    </td>
  );
}

function Filters({
  search,
  onSearch,
  direction,
  onDirection,
  position,
  onPosition,
  allowLocked,
  count
}: {
  search: string;
  onSearch: (value: string) => void;
  direction: PriceDirection;
  onDirection: (value: PriceDirection) => void;
  position: PositionFilter;
  onPosition: (value: PositionFilter) => void;
  allowLocked: boolean;
  count: number;
}) {
  const { tr } = useLocale();
  const selectClass =
    // 16px on phones: iOS Safari zooms the page when a form control under 16px gets focus.
    "min-h-9 rounded-full border border-[var(--border)] bg-white px-3 text-body-lg outline-none transition focus:border-[var(--accent)] md:text-meta";

  return (
    <div className="mb-2 flex flex-wrap items-center gap-1.5">
      <input
        value={search}
        onChange={(event) => onSearch(event.target.value)}
        aria-label={tr("선수 또는 팀 검색", "Search player or team")}
        placeholder={tr("선수·팀 검색", "Search player or team")}
        className="min-h-9 min-w-[10rem] flex-1 rounded-full border border-[var(--border)] bg-white px-4 text-body-lg outline-none transition focus:border-[var(--accent)] md:max-w-[20rem] md:text-meta"
      />
      <select
        value={direction}
        onChange={(event) => onDirection(event.target.value as PriceDirection)}
        aria-label={tr("상승·하락 필터", "Rise and drop filter")}
        className={selectClass}
      >
        <option value="all">{tr("상승·하락", "Rise & drop")}</option>
        <option value="rise">{tr("상승", "Rise")}</option>
        <option value="drop">{tr("하락", "Drop")}</option>
        {allowLocked ? <option value="locked">{tr("잠금", "Locked")}</option> : null}
      </select>
      <select
        value={position}
        onChange={(event) => onPosition(event.target.value as PositionFilter)}
        aria-label={tr("포지션 필터", "Position filter")}
        className={selectClass}
      >
        <option value="all">{tr("전체 선수", "All players")}</option>
        {POSITIONS.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>
      <span className="ml-auto text-caption text-[var(--muted)]">{tr(`${count}명`, `${count} players`)}</span>
    </div>
  );
}

function matchesText(needle: string, webName: string, teamShortName: string) {
  return needle === "" || webName.toLowerCase().includes(needle) || teamShortName.toLowerCase().includes(needle);
}

function useFilters() {
  const [search, setSearch] = useState("");
  const [direction, setDirection] = useState<PriceDirection>("all");
  const [position, setPosition] = useState<PositionFilter>("all");
  const [shown, setShown] = useState(PAGE_SIZE);

  return {
    search,
    direction,
    position,
    shown,
    needle: search.trim().toLowerCase(),
    setSearch: (value: string) => {
      setSearch(value);
      setShown(PAGE_SIZE);
    },
    setDirection: (value: PriceDirection) => {
      setDirection(value);
      setShown(PAGE_SIZE);
    },
    setPosition: (value: PositionFilter) => {
      setPosition(value);
      setShown(PAGE_SIZE);
    },
    clear: () => {
      setSearch("");
      setDirection("all");
      setPosition("all");
      setShown(PAGE_SIZE);
    },
    showMore: () => setShown((count) => count + PAGE_SIZE),
    resetPage: () => setShown(PAGE_SIZE)
  };
}

function Card({ title, hint, children }: { title: string; hint: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-[1.2rem] border border-[var(--border)] bg-[var(--surface)] p-3 shadow-[0_12px_36px_rgba(55,40,20,0.07)]">
      <div className="mb-2">
        <h3 className="text-body-lg font-semibold">{title}</h3>
        <div className="text-caption leading-relaxed text-[var(--muted)]">{hint}</div>
      </div>
      {children}
    </section>
  );
}

function EmptyRow({ colSpan, onClear }: { colSpan: number; onClear: () => void }) {
  const { tr } = useLocale();

  return (
    <tr>
      <td colSpan={colSpan} className="border-t border-[var(--border)] py-6 text-center text-body text-[var(--muted)]">
        {tr("조건에 맞는 선수가 없습니다.", "No players match these filters.")}
        <button type="button" onClick={onClear} className="ml-2 font-semibold text-[var(--accent)] underline underline-offset-4">
          {tr("필터 지우기", "Clear filters")}
        </button>
      </td>
    </tr>
  );
}

function ShowMore({ remaining, onClick }: { remaining: number; onClick: () => void }) {
  const { tr } = useLocale();

  if (remaining <= 0) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-2 w-full rounded-full border border-[var(--border)] bg-white py-2 text-meta font-semibold text-[var(--muted)] transition hover:border-[var(--accent)]"
    >
      {tr(`더 보기 (${remaining})`, `Show more (${remaining})`)}
    </button>
  );
}

const pad = (value: number) => String(value).padStart(2, "0");

/** "09 : 46 : 34" to the next scheduled update, and its time on the viewer's own clock. */
function NextUpdate({ nextUpdate }: { nextUpdate: string | null }) {
  const { tr, locale } = useLocale();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  if (!nextUpdate) {
    return null;
  }

  const target = new Date(nextUpdate);
  const seconds = Math.max(0, Math.floor((target.getTime() - now) / 1000));
  const clock = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(target);

  return (
    <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 rounded-xl border border-[var(--border)] bg-white px-3 py-2">
      <span className="text-meta">{tr("다음 가격 변동까지", "Next price changes happen in")}</span>
      <span className="text-lg font-semibold tabular-nums">
        {pad(Math.floor(seconds / 3600))}:{pad(Math.floor((seconds % 3600) / 60))}:{pad(seconds % 60)}
      </span>
      <span className="text-caption text-[var(--muted)]">
        {tr(`다음 변동 ${clock} (현지 시간)`, `Next price change at ${clock} (local time)`)}
      </span>
    </div>
  );
}

function PredictionsTable({ players, nextUpdate, onSelect }: { players: PlayerStat[]; nextUpdate: string | null; onSelect: (id: number) => void }) {
  const { tr } = useLocale();
  const filters = useFilters();
  const { sort, toggle } = useSort<PredictionKey>();

  const rows = useMemo(() => {
    const matched = selectPricePredictions(players).filter(
      (player) =>
        matchesText(filters.needle, player.webName, player.teamShortName) &&
        matchesDirection(player, filters.direction) &&
        (filters.position === "all" || player.position === filters.position)
    );
    return applySort(matched, sort, predictionValue);
  }, [players, filters.needle, filters.direction, filters.position, sort]);

  const statusLabel: Record<PriceStatus, string> = {
    "very-likely-rise": tr("상승 매우 유력", "Very likely to rise"),
    "likely-rise": tr("상승 유력", "Likely to rise"),
    "no-change": tr("변동 가능성 낮음", "Unlikely to change"),
    "likely-drop": tr("하락 유력", "Likely to drop"),
    "very-likely-drop": tr("하락 매우 유력", "Very likely to drop")
  };

  const header = (key: PredictionKey) => ({
    active: sort?.key === key,
    dir: (sort?.dir ?? "desc") as SortDir,
    onSort: () => {
      toggle(key);
      filters.resetPage();
    }
  });

  return (
    <Card
      title={tr("가격 변동 예측", "Price change predictions")}
      hint={tr(
        "공식 FPL 가격 변동 페이지와 같은 데이터입니다. 진행률은 지금 위치, 예상 진행률은 다음 갱신 시점의 예상치이며, 상태는 FPL이 직접 판정합니다. 15분마다 갱신됩니다.",
        "The same data as FPL's official price changes page. Progress is where a player stands now, predicted progress where FPL expects him at the next update, and the status is FPL's own call. Updates every 15 minutes."
      )}
    >
      <NextUpdate nextUpdate={nextUpdate} />
      <Filters
        search={filters.search}
        onSearch={filters.setSearch}
        direction={filters.direction}
        onDirection={filters.setDirection}
        position={filters.position}
        onPosition={filters.setPosition}
        allowLocked
        count={rows.length}
      />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-separate border-spacing-0 text-left text-meta">
          <thead className="text-caption uppercase tracking-wide text-[var(--muted)]">
            <tr>
              <th className="py-1.5 pr-2 font-semibold">{tr("선수", "Player")}</th>
              <th className="px-1 py-1.5"><SortHeader label={tr("상태", "Status")} {...header("status")} /></th>
              <th className="px-1 py-1.5"><SortHeader label={tr("진행률", "Progress")} {...header("progress")} /></th>
              <th className="px-1 py-1.5"><SortHeader label={tr("예상 진행률", "Predicted")} {...header("projected")} /></th>
              <th className="px-1 py-1.5"><SortHeader label={tr("소유 추세", "Ownership")} {...header("ownership")} /></th>
              <th className="py-1.5 pl-1 text-right"><SortHeader label={tr("현재가", "Price")} align="right" {...header("cost")} /></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? <EmptyRow colSpan={6} onClear={filters.clear} /> : null}
            {rows.slice(0, filters.shown).map((player) => {
              const status = priceStatus(player.priceLikelihood);
              const trend = ownershipTrend(player);
              const chip = `rounded-md px-1.5 py-0.5 text-caption font-semibold tabular-nums ${STATUS_STYLE[status]}`;

              return (
                <tr key={player.id}>
                  <PlayerCell
                    id={player.id}
                    webName={player.webName}
                    teamShortName={player.teamShortName}
                    position={player.position}
                    onSelect={onSelect}
                    mark={<AvailabilityMark status={player.status} news={player.news} />}
                  />
                  <td className="border-t border-[var(--border)] px-2 py-1.5">
                    {player.priceLockedUntil ? (
                      <span className={`rounded-full px-2 py-0.5 text-caption font-semibold ${STATUS_STYLE["no-change"]}`}>
                        {tr(
                          `${daysUntilUnlock(player.priceLockedUntil)}일 후 잠금 해제`,
                          `Unlocks in ${daysUntilUnlock(player.priceLockedUntil)} days`
                        )}
                      </span>
                    ) : player.priceCalibrating ? (
                      <span className={`rounded-full px-2 py-0.5 text-caption font-semibold ${STATUS_STYLE["no-change"]}`}>
                        {tr("보정 중", "Calibrating")}
                      </span>
                    ) : (
                      <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-caption font-semibold ${STATUS_STYLE[status]}`}>
                        {statusLabel[status]}
                      </span>
                    )}
                  </td>
                  <td className="border-t border-[var(--border)] px-2 py-1.5">
                    <span className={chip}>{signed(player.priceChangePercent)}</span>
                  </td>
                  <td className="border-t border-[var(--border)] px-2 py-1.5">
                    <span className={chip}>{signed(player.projectedPercent)}</span>
                  </td>
                  <td className="border-t border-[var(--border)] px-2 py-1.5 text-caption">
                    {trend === null ? (
                      <span className="text-[var(--muted)]">-</span>
                    ) : trend === "up" ? (
                      <span className="text-[var(--accent)]">↗ {tr("상승", "Up")}</span>
                    ) : (
                      <span className="text-[var(--danger)]">↘ {tr("하락", "Down")}</span>
                    )}
                  </td>
                  <td className="border-t border-[var(--border)] py-1.5 pl-2 text-right tabular-nums">{formatMoney(player.cost)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <ShowMore remaining={rows.length - filters.shown} onClick={filters.showMore} />
    </Card>
  );
}

function HistoryTable({
  history,
  players,
  onSelect
}: {
  history: PriceChangeEvent[];
  players: PlayerStat[];
  onSelect: (id: number) => void;
}) {
  const { tr, locale } = useLocale();
  const filters = useFilters();
  const { sort, toggle } = useSort<HistoryKey>();
  const playersById = useMemo(() => new Map(players.map((player) => [player.id, player])), [players]);
  const dateFormat = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "ko-KR", { day: "numeric", month: "short", year: "numeric" }),
    [locale]
  );

  const rows = useMemo(() => {
    const matched = selectRecentPriceChanges(history).filter((change) => {
      const delta = change.costAfter - change.costBefore;

      return (
        matchesText(filters.needle, change.webName, change.teamShortName) &&
        (filters.direction === "rise" ? delta > 0 : filters.direction === "drop" ? delta < 0 : true) &&
        (filters.position === "all" || change.position === filters.position)
      );
    });
    return applySort(matched, sort, historyValue);
  }, [history, filters.needle, filters.direction, filters.position, sort]);

  const header = (key: HistoryKey) => ({
    active: sort?.key === key,
    dir: (sort?.dir ?? "desc") as SortDir,
    onSort: () => {
      toggle(key);
      filters.resetPage();
    }
  });

  return (
    <Card
      title={tr("최근 가격 변동", "Recent price changes")}
      hint={tr(
        "FPL이 기록한 실제 가격 변동 내역입니다. 변동 날짜는 현지 시간 기준입니다.",
        "Every price move FPL has recorded, dated in your local time."
      )}
    >
      <Filters
        search={filters.search}
        onSearch={filters.setSearch}
        direction={filters.direction}
        onDirection={filters.setDirection}
        position={filters.position}
        onPosition={filters.setPosition}
        allowLocked={false}
        count={rows.length}
      />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] border-separate border-spacing-0 text-left text-meta">
          <thead className="text-caption uppercase tracking-wide text-[var(--muted)]">
            <tr>
              <th className="py-1.5 pr-2 font-semibold">{tr("선수", "Player")}</th>
              <th className="px-1 py-1.5"><SortHeader label={tr("날짜", "Date")} {...header("date")} /></th>
              <th className="px-1 py-1.5"><SortHeader label={tr("변동", "Change")} {...header("change")} /></th>
              <th className="px-1 py-1.5 text-right"><SortHeader label={tr("이전가", "Previous")} align="right" {...header("before")} /></th>
              <th className="py-1.5 pl-1 text-right"><SortHeader label={tr("새 가격", "New price")} align="right" {...header("after")} /></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? <EmptyRow colSpan={5} onClear={filters.clear} /> : null}
            {rows.slice(0, filters.shown).map((change) => {
              const delta = change.costAfter - change.costBefore;
              const player = playersById.get(change.playerId);

              return (
                <tr key={`${change.playerId}-${change.changedAt}`}>
                  <PlayerCell
                    id={change.playerId}
                    webName={change.webName}
                    teamShortName={change.teamShortName}
                    position={change.position}
                    onSelect={onSelect}
                    mark={player ? <AvailabilityMark status={player.status} news={player.news} /> : null}
                  />
                  <td className="border-t border-[var(--border)] px-2 py-1.5 tabular-nums">{dateFormat.format(new Date(change.changedAt))}</td>
                  <td className="border-t border-[var(--border)] px-2 py-1.5">
                    <span
                      className={`rounded-md px-1.5 py-0.5 text-caption font-semibold tabular-nums ${
                        STATUS_STYLE[delta > 0 ? "very-likely-rise" : "very-likely-drop"]
                      }`}
                    >
                      {delta > 0 ? "+" : "-"}
                      {money(Math.abs(delta))}
                    </span>
                  </td>
                  <td className="border-t border-[var(--border)] px-2 py-1.5 text-right tabular-nums">{formatMoney(change.costBefore)}</td>
                  <td className="border-t border-[var(--border)] py-1.5 pl-2 text-right tabular-nums">{formatMoney(change.costAfter)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <ShowMore remaining={rows.length - filters.shown} onClick={filters.showMore} />
    </Card>
  );
}

/**
 * Predictions and recent changes as two stacked tables, both read from `/api/price-changes`
 * so the league tab and the public page show exactly what fantasy.premierleague.com does.
 */
export function PriceChangesSection({ onSelect }: { onSelect: (id: number) => void }) {
  const { tr } = useLocale();
  const query = useQuery({
    queryKey: ["price-changes"],
    queryFn: () => fetchPriceChanges(tr("가격 데이터를 불러오지 못했습니다.", "Could not load price data.")),
    refetchInterval: 60_000
  });

  if (query.isLoading) {
    return <div className="h-64 animate-pulse rounded-2xl border border-[var(--border)] bg-[var(--surface)]/80" />;
  }

  if (!query.data) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-[var(--danger)]">
        {(query.error as Error | null)?.message ?? tr("가격 데이터를 불러오지 못했습니다.", "Could not load price data.")}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3">
      <PredictionsTable players={query.data.players} nextUpdate={query.data.nextUpdate} onSelect={onSelect} />
      <HistoryTable history={query.data.history} players={query.data.players} onSelect={onSelect} />
    </div>
  );
}
