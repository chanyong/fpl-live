"use client";

import { useEffect, useMemo, useState } from "react";
import type { LeagueRow } from "@/lib/types";
import { computeRivalGap } from "@/lib/rank-movement";
import { useLocale } from "@/components/locale-provider";

type Saved = { me: number | null; rival: number | null };

function storageKey(leagueId: number) {
  return `fpl-live-rival:${leagueId}`;
}

function signed(value: number) {
  return value > 0 ? `+${value}` : String(value);
}

function gapTone(value: number) {
  return value > 0 ? "text-emerald-700" : value < 0 ? "text-[var(--danger)]" : "text-[var(--muted)]";
}

/** "Me vs my rival": two managers picked once per league (kept in this browser), gap shown live. */
export function RivalCard({ leagueId, rows }: { leagueId: number; rows: LeagueRow[] }) {
  const { tr } = useLocale();
  const [saved, setSaved] = useState<Saved>({ me: null, rival: null });

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey(leagueId));
      if (raw) {
        const value = JSON.parse(raw) as Partial<Saved>;
        setSaved({
          me: typeof value.me === "number" ? value.me : null,
          rival: typeof value.rival === "number" ? value.rival : null
        });
      }
    } catch {
      // Unreadable storage: start empty.
    }
  }, [leagueId]);

  function update(next: Saved) {
    setSaved(next);
    try {
      window.localStorage.setItem(storageKey(leagueId), JSON.stringify(next));
    } catch {
      // Blocked storage: the choice lasts for this visit.
    }
  }

  const sorted = useMemo(() => [...rows].sort((a, b) => a.projectedRank - b.projectedRank), [rows]);
  const me = rows.find((row) => row.entryId === saved.me) ?? null;
  const rival = rows.find((row) => row.entryId === saved.rival) ?? null;
  const gap = me && rival && me.entryId !== rival.entryId ? computeRivalGap(me, rival) : null;

  const select = (value: number | null, onChange: (id: number | null) => void, label: string) => (
    <label className="flex min-w-0 flex-1 flex-col gap-1 text-[11px] font-semibold text-[var(--muted)]">
      {label}
      <select
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value ? Number(event.target.value) : null)}
        className="min-h-9 w-full min-w-0 rounded-lg border border-[var(--border)] bg-white px-2 text-[13px] font-medium text-[var(--text)]"
      >
        <option value="">{tr("선택", "Choose")}</option>
        {sorted.map((row) => (
          <option key={row.entryId} value={row.entryId}>
            {row.projectedRank}. {row.managerName} ({row.teamName})
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <section className="rounded-[1.1rem] border border-[var(--border)] bg-[var(--surface)] p-3" aria-labelledby="rival-card-title">
      <h2 id="rival-card-title" className="text-sm font-semibold">
        {tr("내 라이벌과 점수 차", "Me vs my rival")}
      </h2>
      <div className="mt-2 flex gap-2">
        {select(saved.me, (id) => update({ ...saved, me: id }), tr("나", "Me"))}
        {select(saved.rival, (id) => update({ ...saved, rival: id }), tr("라이벌", "Rival"))}
      </div>

      {gap && me && rival ? (
        <div className="mt-3 space-y-2 text-[13px]">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-white px-2 py-2">
              <div className="text-[11px] text-[var(--muted)]">{tr("이번 GW", "This GW")}</div>
              <div className={`text-lg font-bold tabular-nums ${gapTone(gap.gwGap)}`}>{signed(gap.gwGap)}</div>
              <div className="text-[11px] tabular-nums text-[var(--muted)]">
                {me.gwPoints} : {rival.gwPoints}
              </div>
            </div>
            <div className="rounded-lg bg-white px-2 py-2">
              <div className="text-[11px] text-[var(--muted)]">{tr("총점(잠정)", "Total (live)")}</div>
              <div className={`text-lg font-bold tabular-nums ${gapTone(gap.totalGap)}`}>{signed(gap.totalGap)}</div>
              <div className="text-[11px] tabular-nums text-[var(--muted)]">
                {me.projectedTotalPoints} : {rival.projectedTotalPoints}
              </div>
            </div>
            <div className="rounded-lg bg-white px-2 py-2">
              <div className="text-[11px] text-[var(--muted)]">{tr("순위", "Rank")}</div>
              <div className={`text-lg font-bold tabular-nums ${gapTone(gap.rankGap)}`}>
                {me.projectedRank} : {rival.projectedRank}
              </div>
              <div className="text-[11px] text-[var(--muted)]">{tr("잠정 순위", "projected")}</div>
            </div>
          </div>
          <p className="text-[12px] text-[var(--muted)]">
            {tr("주장", "Captains")}: <b className="text-[var(--text)]">{me.captainName}</b> vs{" "}
            <b className="text-[var(--text)]">{rival.captainName}</b>
            {gap.captainDiff ? <span className="ml-1 font-semibold text-amber-700">{tr("· 주장이 달라요", "· different")}</span> : null}
          </p>
          <div className="grid grid-cols-2 gap-2 text-[12px]">
            {(
              [
                [tr("나만 가진 선발", "Only in my XI"), gap.myOnly],
                [tr("라이벌만 가진 선발", "Only in rival's XI"), gap.rivalOnly]
              ] as const
            ).map(([label, list]) => (
              <div key={label} className="rounded-lg bg-white px-2 py-1.5">
                <div className="mb-1 text-[11px] font-semibold text-[var(--muted)]">{label}</div>
                {list.length === 0 ? (
                  <div className="text-[var(--muted)]">-</div>
                ) : (
                  list.slice(0, 6).map((player) => (
                    <div key={player.elementId} className="flex justify-between gap-1">
                      <span className="truncate">{player.webName}</span>
                      <span className="shrink-0 tabular-nums">{player.livePoints}</span>
                    </div>
                  ))
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="mt-2 text-[12px] text-[var(--muted)]">
          {tr(
            "나와 라이벌을 한 번 고르면 이 브라우저에 기억해 두고, 경기 중에도 점수 차를 계속 보여 줍니다.",
            "Pick yourself and a rival once; this browser remembers them and keeps the gap updated during matches."
          )}
        </p>
      )}
    </section>
  );
}
