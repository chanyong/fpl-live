"use client";

import { useMemo, useState } from "react";
import { CaretDown, SortToggle } from "@/components/icons";
import { FdrStrip } from "@/components/fdr-strip";
import { availability } from "@/lib/player-metrics";
import { formatMoney } from "@/lib/season-summary";
import type { PlayerStat, TeamFixtureOutlook } from "@/lib/types";

type SortKey = "form" | "selectedByPercent" | "eventPoints" | "totalPoints" | "pointsPerGame" | "cost";

const COLUMNS: Array<{ key: SortKey; label: string; format: (player: PlayerStat) => string }> = [
  { key: "selectedByPercent", label: "소유율", format: (player) => `${player.selectedByPercent}%` },
  { key: "form", label: "폼", format: (player) => player.form.toFixed(1) },
  { key: "eventPoints", label: "GW 점수", format: (player) => String(player.eventPoints) },
  { key: "totalPoints", label: "누적", format: (player) => String(player.totalPoints) },
  { key: "pointsPerGame", label: "경기당", format: (player) => player.pointsPerGame.toFixed(1) },
  { key: "cost", label: "가격", format: (player) => formatMoney(player.cost) }
];

/** Low ownership sorts the other way — a smaller number is the more interesting one. */
const ASCENDING: SortKey[] = ["selectedByPercent", "cost"];

export function DifferentialList({
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
  const [sortKey, setSortKey] = useState<SortKey>("form");

  const rows = useMemo(
    () =>
      [...players].sort((left, right) =>
        ASCENDING.includes(sortKey)
          ? left[sortKey] - right[sortKey] || right.form - left.form
          : right[sortKey] - left[sortKey] || right.totalPoints - left.totalPoints
      ),
    [players, sortKey]
  );

  if (rows.length === 0) {
    return (
      <p className="py-6 text-center text-[13px] text-[var(--muted)]">
        지금은 조건을 만족하는 선수가 없습니다. 경기가 진행되면 채워집니다.
      </p>
    );
  }

  const ownedCount = rows.filter((player) => ownedIds.has(player.id)).length;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[12px] text-[var(--muted)]">
        {rows.length}명 · 이 중 우리 리그가 이미 가진 선수는 {ownedCount}명입니다.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-[var(--border)] text-[10px] uppercase tracking-[0.08em] text-[var(--muted)]">
              <th className="px-2 py-2 text-left">선수</th>
              <th className="px-2 py-2 text-left">포지션</th>
              {COLUMNS.map((column) => {
                const active = sortKey === column.key;

                return (
                  <th key={column.key} className="px-2 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => setSortKey(column.key)}
                      aria-sort={active ? (ASCENDING.includes(column.key) ? "ascending" : "descending") : "none"}
                      className={`inline-flex items-center gap-1 ${active ? "text-[var(--text)]" : ""}`}
                    >
                      {column.label}
                      {active ? <CaretDown className={ASCENDING.includes(column.key) ? "rotate-180" : ""} /> : <SortToggle />}
                    </button>
                  </th>
                );
              })}
              <th className="px-2 py-2 text-left">다음 5경기</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((player) => {
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
                      <span className="text-[11px] text-[var(--muted)]">{player.teamShortName}</span>
                      {owned ? (
                        <span
                          title="우리 리그가 이미 보유"
                          className="rounded-full bg-[var(--accent-soft)] px-1.5 text-[10px] font-semibold text-[var(--accent)]"
                        >
                          리그
                        </span>
                      ) : null}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-[12px] text-[var(--muted)]">{player.position}</td>
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
          </tbody>
        </table>
      </div>
    </div>
  );
}
