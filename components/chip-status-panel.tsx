"use client";

import { useMemo } from "react";
import { CHIP_SHORT_LABELS, chipLabel } from "@/lib/chips";
import type { ChipStatus, RankChangeManager } from "@/lib/types";
import { useLocale } from "@/components/locale-provider";

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
  const { tr, locale } = useLocale();
  if (!chip) {
    return <span className="text-[var(--muted)]">-</span>;
  }

  if (chip.usedEvent !== null) {
    return (
      <span
        className="inline-block rounded-md bg-[var(--accent)] px-2 py-0.5 text-caption font-semibold text-white"
        title={tr(
          `${chipLabel(chip.name, false, locale)} · GW${chip.usedEvent} 사용`,
          `${chipLabel(chip.name, false, locale)} · played in GW${chip.usedEvent}`
        )}
      >
        GW{chip.usedEvent}
      </span>
    );
  }

  if (chip.expired) {
    return (
      <span
        className="inline-block rounded-md bg-stone-200 px-2 py-0.5 text-caption font-medium text-stone-500 line-through"
        title={tr(
          `${chipLabel(chip.name, false, locale)} · GW${chip.stop}까지 못 씀`,
          `${chipLabel(chip.name, false, locale)} · not used by GW${chip.stop}`
        )}
      >
        {tr("만료", "Expired")}
      </span>
    );
  }

  return (
    <span
      className="inline-block rounded-md border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-caption font-semibold text-emerald-800"
      title={tr(
        `${chipLabel(chip.name, false, locale)} · GW${chip.start}~${chip.stop} 사용 가능`,
        `${chipLabel(chip.name, false, locale)} · available GW${chip.start}–${chip.stop}`
      )}
    >
      {tr("보유", "Held")}
    </span>
  );
}

export function ChipStatusPanel({ managers }: { managers: RankChangeManager[] }) {
  const { tr } = useLocale();
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
    <section className="rounded-md border border-[var(--border)] bg-[var(--surface)] p-3">
      <div className="mb-3">
        <div className="text-body-lg font-semibold">{tr("칩 사용 현황", "Chip status")}</div>
        <div className="text-caption text-[var(--muted)]">
          {tr("남은 칩 많은 순", "Most chips left first")}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-meta">
          <thead>
            <tr className="border-b border-[var(--border)] text-caption uppercase tracking-[0.08em] text-[var(--muted)]">
              <th className="px-2 py-2 text-left" rowSpan={2}>
                {tr("매니저", "Manager")}
              </th>
              <th className="px-2 py-2 text-right" rowSpan={2}>
                {tr("남음", "Left")}
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
            <tr className="border-b border-[var(--border)] bg-[var(--surface-strong)]/40 text-caption uppercase tracking-[0.06em] text-[var(--muted)]">
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
                <tr key={manager.entry} className="border-b border-[var(--border)] bg-[var(--bg)]">
                  <td className="px-2 py-2">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: manager.color }} />
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">{manager.entryName}</span>
                        <span className="block truncate text-caption text-[var(--muted)]">{manager.playerName}</span>
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
