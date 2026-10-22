"use client";

import { useMemo, useState } from "react";
import { priceOutlook, selectPricePredictions, selectRecentPriceChanges, type PriceOutlook } from "@/lib/price-changes";
import { formatMoney } from "@/lib/season-summary";
import type { PlayerStat } from "@/lib/types";
import { useLocale } from "@/components/locale-provider";

type PriceView = "predictions" | "recent";
type SortKey = "progress" | "projected" | "outlook" | "cost" | "change";
type SortDir = "desc" | "asc";
type Trend = "rise" | "fall";

const PAGE_SIZE = 20;

/** Rises read green and falls read red everywhere in this table; the cell tint carries the direction. */
const CELL_TINT: Record<Trend, string> = {
  rise: "bg-[var(--accent-soft)] text-[var(--accent-ink)]",
  fall: "bg-[#fbe5e2] text-[#8a2323]"
};

const BADGE_STYLE: Record<PriceOutlook, Record<Trend, string>> = {
  "very-likely": {
    rise: "bg-[var(--accent)] text-white",
    fall: "bg-[var(--danger)] text-white"
  },
  likely: {
    rise: "bg-[#b9e6d2] text-[var(--accent-ink)]",
    fall: "bg-[#f4c7c2] text-[#7a1f1f]"
  },
  unlikely: {
    rise: "bg-[var(--accent-soft)] text-[var(--accent-ink)]",
    fall: "bg-[#fbe5e2] text-[#8a2323]"
  }
};

function signed(value: number) {
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

const OUTLOOK_RANK: Record<PriceOutlook, number> = { "very-likely": 2, likely: 1, unlikely: 0 };

/** Larger = stronger. Locked players sink below everything else. */
function outlookScore(player: PlayerStat) {
  return isLocked(player) ? -1 : OUTLOOK_RANK[priceOutlook(player.projectedPercent)];
}

function sortValue(player: PlayerStat, key: SortKey) {
  switch (key) {
    case "progress":
      return player.priceChangePercent;
    case "projected":
      return player.projectedPercent;
    case "outlook":
      return outlookScore(player) * 1000 + Math.abs(player.projectedPercent);
    case "cost":
      return player.cost;
    case "change":
      return player.costChangeEvent;
  }
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

function isLocked(player: PlayerStat) {
  return player.priceLockedUntil !== null && new Date(player.priceLockedUntil).getTime() > Date.now();
}

function PriceTable({ view, players, onSelect }: { view: PriceView; players: PlayerStat[]; onSelect: (id: number) => void }) {
  const { tr } = useLocale();
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir } | null>(null);
  const [search, setSearch] = useState("");
  const [shown, setShown] = useState(PAGE_SIZE);

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const base = view === "predictions" ? selectPricePredictions(players) : selectRecentPriceChanges(players);
    const matched = base.filter(
      (player) =>
        needle === "" ||
        player.webName.toLowerCase().includes(needle) ||
        player.teamShortName.toLowerCase().includes(needle)
    );

    if (!sort) {
      return matched;
    }

    const factor = sort.dir === "desc" ? -1 : 1;
    return [...matched].sort((left, right) => factor * (sortValue(left, sort.key) - sortValue(right, sort.key)));
  }, [players, view, search, sort]);

  const outlookLabel: Record<PriceOutlook, string> = {
    "very-likely": tr("매우 유력", "Very likely"),
    likely: tr("유력", "Likely"),
    unlikely: tr("가능성 낮음", "Unlikely")
  };

  function reset() {
    setShown(PAGE_SIZE);
  }

  function resetSearch() {
    setSearch("");
    reset();
  }

  /** First click sorts high to low, a second flips it, a third returns to the default order. */
  function toggleSort(key: SortKey) {
    setSort((current) => {
      if (!current || current.key !== key) {
        return { key, dir: "desc" };
      }
      return current.dir === "desc" ? { key, dir: "asc" } : null;
    });
    reset();
  }

  const headerProps = (key: SortKey) => ({
    active: sort?.key === key,
    dir: (sort?.dir ?? "desc") as SortDir,
    onSort: () => toggleSort(key)
  });

  return (
    <section className="rounded-[1.2rem] border border-[var(--border)] bg-[var(--surface)] p-3 shadow-[0_12px_36px_rgba(55,40,20,0.07)]">
      <div className="mb-2">
        <h3 className="text-[1rem] font-semibold">
          {view === "predictions" ? tr("가격 변동 예측", "Price change predictions") : tr("최근 가격 변동", "Recent price changes")}
        </h3>
        <p className="text-[12px] leading-relaxed text-[var(--muted)]">
          {view === "predictions"
            ? tr(
                "FPL이 제공하는 진행률과 다음 갱신 예상치입니다. 100%에 닿으면 상승, −100%에 닿으면 하락합니다.",
                "FPL's progress meter and its projection for the next update. +100% means a rise, −100% a fall."
              )
            : tr(
                "직전 데드라인 이후 이미 가격이 움직인 선수입니다. FPL 공개 데이터에는 변동 날짜가 없습니다.",
                "Players whose price has moved since the last deadline. FPL's public data carries no change dates."
              )}
        </p>
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <input
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            reset();
          }}
          aria-label={tr("선수 또는 팀 검색", "Search player or team")}
          placeholder={tr("선수·팀 검색", "Search player or team")}
          className="min-h-9 min-w-[10rem] flex-1 rounded-full border border-[var(--border)] bg-white px-4 text-[13px] outline-none transition focus:border-[var(--accent)] md:max-w-[20rem]"
        />
        <span className="ml-auto text-[12px] text-[var(--muted)]">{tr(`${rows.length}명`, `${rows.length} players`)}</span>
      </div>

      <div className="overflow-x-auto">
          <table className="w-full min-w-[460px] border-separate border-spacing-0 text-left text-[13px]">
            <thead className="text-[11px] uppercase tracking-wide text-[var(--muted)]">
              <tr>
                <th className="py-1.5 pr-2 font-semibold">{tr("선수", "Player")}</th>
                {view === "predictions" ? (
                  <>
                    <th className="px-1 py-1.5"><SortHeader label={tr("진행률", "Progress")} {...headerProps("progress")} /></th>
                    <th className="px-1 py-1.5"><SortHeader label={tr("예상", "Projected")} {...headerProps("projected")} /></th>
                    <th className="px-1 py-1.5"><SortHeader label={tr("전망", "Outlook")} {...headerProps("outlook")} /></th>
                    <th className="py-1.5 pl-1 text-right"><SortHeader label={tr("현재가", "Price")} align="right" {...headerProps("cost")} /></th>
                  </>
                ) : (
                  <>
                    <th className="px-1 py-1.5"><SortHeader label={tr("변동", "Change")} {...headerProps("change")} /></th>
                    <th className="py-1.5 pl-2 text-right font-semibold">{tr("이전 → 현재", "Was → Now")}</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={view === "predictions" ? 5 : 3} className="border-t border-[var(--border)] py-6 text-center text-sm text-[var(--muted)]">
                    {tr("검색에 맞는 선수가 없습니다.", "No players match your search.")}
                    <button
                      type="button"
                      onClick={resetSearch}
                      className="ml-2 font-semibold text-[var(--accent)] underline underline-offset-4"
                    >
                      {tr("검색 지우기", "Clear search")}
                    </button>
                  </td>
                </tr>
              ) : null}
              {rows.slice(0, shown).map((player) => {
                const trend: Trend =
                  (view === "predictions" ? player.projectedPercent : player.costChangeEvent) >= 0 ? "rise" : "fall";
                const progressTrend: Trend = player.priceChangePercent >= 0 ? "rise" : "fall";
                const outlook = priceOutlook(player.projectedPercent);

                return (
                  <tr key={player.id}>
                    <td className="border-t border-[var(--border)] py-1.5 pr-2">
                      <button
                        type="button"
                        onClick={() => onSelect(player.id)}
                        className="text-left font-semibold underline-offset-4 hover:text-[var(--accent)] hover:underline"
                      >
                        {player.webName}
                      </button>
                      <span className="ml-1.5 text-[11px] text-[var(--muted)]">
                        {player.teamShortName} · {player.position}
                      </span>
                    </td>
                    {view === "predictions" ? (
                      <>
                        <td className={`border-t border-[var(--border)] px-2 py-1.5 font-semibold tabular-nums ${CELL_TINT[progressTrend]}`}>
                          {signed(player.priceChangePercent)}
                        </td>
                        <td className={`border-t border-[var(--border)] px-2 py-1.5 font-semibold tabular-nums ${CELL_TINT[trend]}`}>
                          {signed(player.projectedPercent)}
                        </td>
                        <td className="border-t border-[var(--border)] px-2 py-1.5">
                          {isLocked(player) ? (
                            <span className="text-[11px] text-[var(--muted)]">{tr("변동 잠금", "Locked")}</span>
                          ) : (
                            <span
                              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${BADGE_STYLE[outlook][trend]}`}
                            >
                              {outlookLabel[outlook]} {trend === "rise" ? "▲" : "▼"}
                            </span>
                          )}
                        </td>
                        <td className="border-t border-[var(--border)] py-1.5 pl-2 text-right tabular-nums">
                          {formatMoney(player.cost)}
                        </td>
                      </>
                    ) : (
                      <>
                        <td className={`border-t border-[var(--border)] px-2 py-1.5 font-semibold tabular-nums ${CELL_TINT[trend]}`}>
                          {trend === "rise" ? "▲ +" : "▼ −"}£{(Math.abs(player.costChangeEvent) / 10).toFixed(1)}m
                        </td>
                        <td className={`border-t border-[var(--border)] py-1.5 pl-2 text-right tabular-nums ${CELL_TINT[trend]}`}>
                          {formatMoney(player.cost - player.costChangeEvent)} → {formatMoney(player.cost)}
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
      </div>

      {rows.length > shown ? (
        <button
          type="button"
          onClick={() => setShown((count) => count + PAGE_SIZE)}
          className="mt-2 w-full rounded-full border border-[var(--border)] bg-white py-2 text-[13px] font-semibold text-[var(--muted)] transition hover:border-[var(--accent)]"
        >
          {tr(`더 보기 (${rows.length - shown})`, `Show more (${rows.length - shown})`)}
        </button>
      ) : null}
    </section>
  );
}

/** Predictions and recent changes are separate tables, stacked, rather than tabs of one. */
export function PriceChangesSection({ players, onSelect }: { players: PlayerStat[]; onSelect: (id: number) => void }) {
  return (
    <div className="grid gap-3">
      <PriceTable view="predictions" players={players} onSelect={onSelect} />
      <PriceTable view="recent" players={players} onSelect={onSelect} />
    </div>
  );
}
