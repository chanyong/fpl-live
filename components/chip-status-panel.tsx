"use client";

import { useMemo } from "react";
import { CHIP_SHORT_LABELS } from "@/lib/chips";
import type { ChipStatus, RankChangeManager } from "@/lib/types";

type ChipColumn = {
  key: string;
  name: string;
  label: string;
  start: number;
  stop: number;
};

function windowKey(chip: { name: string; start: number; stop: number }) {
  return `${chip.start}-${chip.stop}-${chip.name}`;
}

/** Groups the season's chip grants into the windows FPL splits them across. */
function buildColumns(chips: ChipStatus[]) {
  const columns: ChipColumn[] = chips.map((chip) => ({
    key: windowKey(chip),
    name: chip.name,
    label: CHIP_SHORT_LABELS[chip.name] ?? chip.name,
    start: chip.start,
    stop: chip.stop
  }));

  const groups = new Map<string, { start: number; stop: number; columns: ChipColumn[] }>();
  for (const column of columns) {
    const key = `${column.start}-${column.stop}`;
    const group = groups.get(key) ?? { start: column.start, stop: column.stop, columns: [] };
    group.columns.push(column);
    groups.set(key, group);
  }

  return [...groups.values()].sort((left, right) => left.start - right.start);
}

function ChipCell({ chip }: { chip: ChipStatus | undefined }) {
  if (!chip) {
    return <span className="text-[var(--muted)]">-</span>;
  }

  if (chip.usedEvent !== null) {
    return (
      <span
        className="inline-block rounded-full bg-[var(--accent)] px-2 py-0.5 text-[11px] font-semibold text-white"
        title={`${chip.label} · GW${chip.usedEvent} 사용`}
      >
        GW{chip.usedEvent}
      </span>
    );
  }

  if (chip.expired) {
    return (
      <span
        className="inline-block rounded-full bg-stone-200 px-2 py-0.5 text-[11px] font-medium text-stone-500 line-through"
        title={`${chip.label} · GW${chip.stop}까지 못 씀`}
      >
        만료
      </span>
    );
  }

  return (
    <span
      className="inline-block rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800"
      title={`${chip.label} · GW${chip.start}~${chip.stop} 사용 가능`}
    >
      보유
    </span>
  );
}

export function ChipStatusPanel({ managers }: { managers: RankChangeManager[] }) {
  const groups = useMemo(() => buildColumns(managers[0]?.season.chips ?? []), [managers]);

  if (groups.length === 0) {
    return null;
  }

  const sorted = [...managers].sort(
    (left, right) =>
      right.season.chipsRemaining - left.season.chipsRemaining ||
      (left.latestRank ?? 999) - (right.latestRank ?? 999)
  );

  return (
    <section className="rounded-[1.2rem] border border-[var(--border)] bg-[var(--surface)] p-3 shadow-[0_12px_36px_rgba(55,40,20,0.07)]">
      <div className="mb-3">
        <div className="text-[1rem] font-semibold">칩 사용 현황</div>
        <div className="text-[12px] text-[var(--muted)]">
          남은 칩이 많은 순입니다. 칩은 전·후반기에 각각 한 번씩 주어집니다.
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-[var(--border)] text-[10px] uppercase tracking-[0.08em] text-[var(--muted)]">
              <th className="px-2 py-2 text-left" rowSpan={2}>
                매니저
              </th>
              <th className="px-2 py-2 text-right" rowSpan={2}>
                남음
              </th>
              {groups.map((group) => (
                <th
                  key={`${group.start}-${group.stop}`}
                  colSpan={group.columns.length}
                  className="border-l border-[var(--border)] px-2 py-2 text-center"
                >
                  GW{group.start}–{group.stop}
                </th>
              ))}
            </tr>
            <tr className="border-b border-[var(--border)] bg-[var(--surface-strong)]/40 text-[10px] uppercase tracking-[0.06em] text-[var(--muted)]">
              {groups.flatMap((group) =>
                group.columns.map((column, index) => (
                  <th
                    key={column.key}
                    className={`px-2 py-1.5 text-center font-semibold ${
                      index === 0 ? "border-l border-[var(--border)]" : ""
                    }`}
                  >
                    {column.label}
                  </th>
                ))
              )}
            </tr>
          </thead>
          <tbody>
            {sorted.map((manager) => {
              const byKey = new Map(manager.season.chips.map((chip) => [windowKey(chip), chip]));

              return (
                <tr key={manager.entry} className="border-b border-[var(--border)] bg-white">
                  <td className="px-2 py-2">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: manager.color }} />
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">{manager.entryName}</span>
                        <span className="block truncate text-[11px] text-[var(--muted)]">{manager.playerName}</span>
                      </span>
                    </span>
                  </td>
                  <td className="px-2 py-2 text-right font-semibold tabular-nums">
                    {manager.season.chipsRemaining}
                  </td>
                  {groups.flatMap((group) =>
                    group.columns.map((column, index) => (
                      <td
                        key={column.key}
                        className={`px-2 py-2 text-center ${index === 0 ? "border-l border-[var(--border)]" : ""}`}
                      >
                        <ChipCell chip={byKey.get(column.key)} />
                      </td>
                    ))
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
