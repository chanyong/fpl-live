"use client";

import { useMemo, useState } from "react";
import { CaretDown, SortToggle } from "@/components/icons";
import { FdrAverage, FdrStrip } from "@/components/fdr-strip";
import { availability, averageDifficulty } from "@/lib/player-metrics";
import { formatMoney } from "@/lib/season-summary";
import type { PlayerStat, TeamFixtureOutlook } from "@/lib/types";
import { useLocale } from "@/components/locale-provider";

/** Fixture difficulty is not in PlayerStat, so it is joined on for the table. */
type Row = PlayerStat & { fixtures: TeamFixtureOutlook[]; avgDifficulty: number | null };

type SortKey =
  | "form"
  | "selectedByPercent"
  | "eventPoints"
  | "totalPoints"
  | "pointsPerGame"
  | "cost"
  | "avgDifficulty";

type Tr = <T = string>(ko: T, en: T) => T;

function buildColumns(tr: Tr): Array<{ key: SortKey; label: string; format: (player: Row) => string }> {
  return [
    { key: "selectedByPercent", label: tr("소유율", "Owned %"), format: (player) => `${player.selectedByPercent}%` },
    { key: "form", label: tr("폼", "Form"), format: (player) => player.form.toFixed(1) },
    { key: "eventPoints", label: tr("GW 점수", "GW pts"), format: (player) => String(player.eventPoints) },
    { key: "totalPoints", label: tr("누적", "Season"), format: (player) => String(player.totalPoints) },
    { key: "pointsPerGame", label: tr("경기당", "Pts/game"), format: (player) => player.pointsPerGame.toFixed(1) },
    { key: "cost", label: tr("가격", "Price"), format: (player) => formatMoney(player.cost) },
    {
      key: "avgDifficulty",
      label: tr("평균 난이도", "Avg difficulty"),
      format: (player) => (player.avgDifficulty === null ? "-" : player.avgDifficulty.toFixed(1))
    }
  ];
}

/** These read better small-first: a cheap player, a light owner base, an easy run. */
const ASCENDING: SortKey[] = ["selectedByPercent", "cost", "avgDifficulty"];

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
  const { tr, locale } = useLocale();
  const columns = useMemo(() => buildColumns(tr), [tr]);
  const [sortKey, setSortKey] = useState<SortKey>("form");

  const rows = useMemo(() => {
    const joined: Row[] = players.map((player) => {
      const fixtures = fdr[player.teamShortName] ?? [];
      return { ...player, fixtures, avgDifficulty: averageDifficulty(fixtures) };
    });

    // A team with no fixtures left sorts last rather than posing as the easiest run.
    const value = (row: Row) => (sortKey === "avgDifficulty" ? row.avgDifficulty ?? 99 : row[sortKey]);

    return joined.sort((left, right) =>
      ASCENDING.includes(sortKey)
        ? value(left) - value(right) || right.form - left.form
        : value(right) - value(left) || right.totalPoints - left.totalPoints
    );
  }, [players, sortKey, fdr]);

  if (rows.length === 0) {
    return (
      <p className="py-6 text-center text-meta text-[var(--muted)]">
        {tr("해당 선수 없음", "No players match")}
      </p>
    );
  }

  const ownedCount = rows.filter((player) => ownedIds.has(player.id)).length;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-caption text-[var(--muted)]">
        {tr(`${rows.length}명 · 리그 보유 ${ownedCount}명`, `${rows.length} players · ${ownedCount} owned in league`)}
      </p>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px] border-collapse text-meta">
          <thead>
            <tr className="border-b border-[var(--border)] text-caption uppercase tracking-[0.08em] text-[var(--muted)]">
              <th className="px-2 py-2 text-left">{tr("선수", "Player")}</th>
              <th className="px-2 py-2 text-left">{tr("포지션", "Position")}</th>
              {columns.map((column) => {
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
              <th className="px-2 py-2 text-left">{tr("다음 5경기", "Next 5")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((player) => {
              const health = availability(player.status, locale);
              const owned = ownedIds.has(player.id);

              return (
                <tr
                  key={player.id}
                  onClick={() => onSelect(player.id)}
                  className="cursor-pointer border-b border-[var(--border)] bg-[var(--bg)] transition last:border-b-0 hover:bg-[var(--surface-strong)]/40"
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
                      <span className="text-caption text-[var(--muted)]">{player.teamShortName}</span>
                      {owned ? (
                        <span
                          title={tr("우리 리그가 이미 보유", "Already owned in our league")}
                          className="rounded-md bg-[var(--accent-soft)] px-1.5 text-caption font-semibold text-[var(--accent)]"
                        >
                          {tr("리그", "League")}
                        </span>
                      ) : null}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-caption text-[var(--muted)]">{player.position}</td>
                  {columns.map((column) => (
                    <td key={column.key} className="px-2 py-1.5 text-right tabular-nums">
                      {column.key === "avgDifficulty" ? (
                        <FdrAverage value={player.avgDifficulty} count={player.fixtures.length} />
                      ) : (
                        column.format(player)
                      )}
                    </td>
                  ))}
                  <td className="px-2 py-1.5">
                    <FdrStrip compact fixtures={player.fixtures} />
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
