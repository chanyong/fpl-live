"use client";

import { useMemo, useState } from "react";
import { CaretDown, CaretUp, SortToggle } from "@/components/icons";
import { FdrStrip } from "@/components/fdr-strip";
import { availability } from "@/lib/player-metrics";
import { formatMoney } from "@/lib/season-summary";
import type { FplPosition, PlayerStat, TeamFixtureOutlook } from "@/lib/types";

type SortKey =
  | "totalPoints"
  | "eventPoints"
  | "form"
  | "pointsPerGame"
  | "selectedByPercent"
  | "netTransfers"
  | "cost"
  | "expectedGoalInvolvements";

const COLUMNS: Array<{ key: SortKey; label: string; format: (player: PlayerStat) => string }> = [
  { key: "eventPoints", label: "GW", format: (player) => String(player.eventPoints) },
  { key: "totalPoints", label: "누적", format: (player) => String(player.totalPoints) },
  { key: "form", label: "폼", format: (player) => player.form.toFixed(1) },
  { key: "pointsPerGame", label: "경기당", format: (player) => player.pointsPerGame.toFixed(1) },
  { key: "selectedByPercent", label: "소유율", format: (player) => `${player.selectedByPercent}%` },
  {
    key: "netTransfers",
    label: "순이적",
    format: (player) =>
      `${player.netTransfers >= 0 ? "+" : "−"}${Math.abs(Math.round(player.netTransfers / 1000))}k`
  },
  { key: "cost", label: "가격", format: (player) => formatMoney(player.cost) },
  { key: "expectedGoalInvolvements", label: "xGI", format: (player) => player.expectedGoalInvolvements.toFixed(2) }
];

const POSITIONS: Array<FplPosition | "ALL"> = ["ALL", "GKP", "DEF", "MID", "FWD"];
const PAGE_SIZE = 25;

export function PlayerTable({
  players,
  fdr,
  ownedIds,
  onSelect
}: {
  players: PlayerStat[];
  fdr: Record<string, TeamFixtureOutlook[]>;
  ownedIds: Set<number>;
  onSelect: (elementId: number) => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("totalPoints");
  const [search, setSearch] = useState("");
  const [position, setPosition] = useState<FplPosition | "ALL">("ALL");
  const [leagueOnly, setLeagueOnly] = useState(false);
  const [limit, setLimit] = useState(PAGE_SIZE);

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();

    return players
      .filter((player) => {
        if (position !== "ALL" && player.position !== position) return false;
        if (leagueOnly && !ownedIds.has(player.id)) return false;
        if (!needle) return true;
        return (
          player.webName.toLowerCase().includes(needle) ||
          player.teamShortName.toLowerCase().includes(needle)
        );
      })
      .sort((left, right) => right[sortKey] - left[sortKey]);
  }, [players, search, position, leagueOnly, ownedIds, sortKey]);

  const visible = rows.slice(0, limit);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-2 rounded-[1rem] border border-[var(--border)] bg-[var(--surface)] p-2.5 md:flex-row md:items-center">
        <input
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setLimit(PAGE_SIZE);
          }}
          placeholder="선수 또는 팀 검색"
          aria-label="선수 또는 팀 검색"
          className="min-h-10 w-full flex-1 rounded-full border border-[var(--border)] bg-white px-4 text-[15px] outline-none focus:border-[var(--accent)] md:text-sm"
        />
        <div className="flex items-center gap-2">
          <div className="flex rounded-full border border-[var(--border)] bg-white p-0.5">
            {POSITIONS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => {
                  setPosition(item);
                  setLimit(PAGE_SIZE);
                }}
                className={`rounded-full px-2.5 py-1 text-[12px] font-semibold transition ${
                  position === item ? "bg-[var(--text)] text-white" : "text-[var(--muted)]"
                }`}
              >
                {item === "ALL" ? "전체" : item}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-1.5 whitespace-nowrap text-[12px] text-[var(--muted)]">
            <input
              type="checkbox"
              checked={leagueOnly}
              onChange={(event) => {
                setLeagueOnly(event.target.checked);
                setLimit(PAGE_SIZE);
              }}
            />
            리그 보유만
          </label>
        </div>
      </div>

      <div className="overflow-x-auto rounded-[1rem] border border-[var(--border)] bg-[var(--surface)]">
        <table className="min-w-[720px] w-full border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--surface-strong)]/40 text-[10px] uppercase tracking-[0.08em] text-[var(--muted)]">
              <th className="px-2 py-2 text-left">선수</th>
              {COLUMNS.map((column) => {
                const active = sortKey === column.key;

                return (
                  <th key={column.key} className="px-2 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => setSortKey(column.key)}
                      aria-sort={active ? "descending" : "none"}
                      className={`inline-flex items-center gap-1 ${active ? "text-[var(--text)]" : ""}`}
                    >
                      {column.label}
                      {active ? <CaretDown /> : <SortToggle />}
                    </button>
                  </th>
                );
              })}
              <th className="px-2 py-2 text-left">다음 5경기</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((player) => {
              const health = availability(player.status);
              const owned = ownedIds.has(player.id);

              return (
                <tr
                  key={player.id}
                  onClick={() => onSelect(player.id)}
                  className="cursor-pointer border-b border-[var(--border)] bg-white transition last:border-b-0 hover:bg-[var(--surface-strong)]/40"
                >
                  <td className="px-2 py-1.5">
                    <span className="flex items-center gap-1.5">
                      {player.status !== "a" ? (
                        <span
                          title={`${health.label}${player.news ? ` · ${player.news}` : ""}`}
                          className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                            health.tone === "warn" ? "bg-[var(--warning)]" : "bg-[var(--danger)]"
                          }`}
                        />
                      ) : null}
                      <span className="font-semibold">{player.webName}</span>
                      <span className="text-[11px] text-[var(--muted)]">
                        {player.teamShortName} · {player.position}
                      </span>
                      {owned ? (
                        <span
                          title="리그 내 보유 선수"
                          className="rounded-full bg-[var(--accent-soft)] px-1.5 text-[10px] font-semibold text-[var(--accent)]"
                        >
                          리그
                        </span>
                      ) : null}
                    </span>
                  </td>
                  {COLUMNS.map((column) => (
                    <td key={column.key} className="px-2 py-1.5 text-right tabular-nums">
                      {column.format(player)}
                    </td>
                  ))}
                  <td className="px-2 py-1.5">
                    <FdrStrip compact fixtures={fdr[player.teamShortName] ?? []} />
                  </td>
                </tr>
              );
            })}
            {visible.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length + 2} className="px-2 py-6 text-center text-[var(--muted)]">
                  조건에 맞는 선수가 없습니다.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {rows.length > limit ? (
        <button
          type="button"
          onClick={() => setLimit((current) => current + PAGE_SIZE)}
          className="mx-auto flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[12px] text-[var(--muted)] transition hover:text-[var(--text)]"
        >
          {rows.length - limit}명 더 보기 <CaretDown />
        </button>
      ) : null}

      {limit > PAGE_SIZE ? (
        <button
          type="button"
          onClick={() => setLimit(PAGE_SIZE)}
          className="mx-auto flex items-center gap-1 text-[12px] text-[var(--muted)] transition hover:text-[var(--text)]"
        >
          접기 <CaretUp />
        </button>
      ) : null}
    </div>
  );
}
