"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { LeagueRow } from "@/lib/types";
import { computeRivalGap } from "@/lib/rank-movement";
import { useLocale } from "@/components/locale-provider";

export type RivalPick = { me: number | null; rival: number | null };

export const EMPTY_RIVAL_PICK: RivalPick = { me: null, rival: null };

/** Earlier versions kept each league's choice in localStorage as `fpl-live-rival:{leagueId}`. */
export const LEGACY_RIVAL_STORAGE_PREFIX = "fpl-live-rival:";

/** Removes choices saved by earlier versions so an old pick never lingers in the browser. */
export function clearLegacyRivalStorage() {
  try {
    const storage = window.localStorage;
    const stale: string[] = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key?.startsWith(LEGACY_RIVAL_STORAGE_PREFIX)) {
        stale.push(key);
      }
    }
    stale.forEach((key) => storage.removeItem(key));
  } catch {
    // Blocked storage: nothing could have been saved there either.
  }
}

/**
 * The me/rival choice for as long as this page stays open. Nothing is saved, so every fresh
 * visit (new tab, reload, typed or shared URL) starts empty.
 *
 * Call it from the dashboard, not from the card: the card unmounts while the 팀·선수 tabs are
 * showing, and the choice has to survive that as well as the 30-second refresh. Another league
 * starts empty too.
 */
export function useRivalPick(leagueId: string) {
  const [state, setState] = useState<{ leagueId: string; pick: RivalPick }>(() => ({
    leagueId,
    pick: EMPTY_RIVAL_PICK
  }));

  useEffect(() => {
    clearLegacyRivalStorage();
  }, []);

  const pick = state.leagueId === leagueId ? state.pick : EMPTY_RIVAL_PICK;
  const setPick = useCallback((next: RivalPick) => setState({ leagueId, pick: next }), [leagueId]);

  return [pick, setPick] as const;
}

function signed(value: number) {
  return value > 0 ? `+${value}` : String(value);
}

function gapTone(value: number) {
  return value > 0 ? "text-emerald-700" : value < 0 ? "text-[var(--danger)]" : "text-[var(--muted)]";
}

/**
 * "Me vs my rival": two managers picked for this visit, gap shown live. The choice is held by
 * the caller (see useRivalPick) and is never saved.
 */
export function RivalCard({
  rows,
  pick,
  onPickChange
}: {
  rows: LeagueRow[];
  pick: RivalPick;
  onPickChange: (next: RivalPick) => void;
}) {
  const { tr } = useLocale();

  const sorted = useMemo(() => [...rows].sort((a, b) => a.projectedRank - b.projectedRank), [rows]);
  const me = rows.find((row) => row.entryId === pick.me) ?? null;
  const rival = rows.find((row) => row.entryId === pick.rival) ?? null;
  const gap = me && rival && me.entryId !== rival.entryId ? computeRivalGap(me, rival) : null;

  const select = (value: number | null, onChange: (id: number | null) => void, label: string) => (
    <label className="flex min-w-0 flex-1 flex-col gap-1 text-caption font-semibold text-[var(--muted)]">
      {label}
      <select
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value ? Number(event.target.value) : null)}
        className="min-h-9 w-full min-w-0 rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 text-body-lg font-medium text-[var(--text)] md:pointer-fine:text-meta"
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
    <section className="rounded-md border border-[var(--border)] bg-[var(--surface)] p-3" aria-labelledby="rival-card-title">
      <h2 id="rival-card-title" className="text-body font-semibold">
        {tr("라이벌 점수 차", "Rival gap")}
      </h2>
      <div className="mt-2 flex gap-2">
        {select(pick.me, (id) => onPickChange({ ...pick, me: id }), tr("나", "Me"))}
        {select(pick.rival, (id) => onPickChange({ ...pick, rival: id }), tr("라이벌", "Rival"))}
      </div>

      {gap && me && rival ? (
        <div className="mt-3 space-y-2 text-meta">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-md bg-[var(--bg)] px-2 py-2">
              <div className="text-caption text-[var(--muted)]">{tr("이번 GW", "This GW")}</div>
              <div className={`text-lg font-bold tabular-nums ${gapTone(gap.gwGap)}`}>{signed(gap.gwGap)}</div>
              <div className="text-caption tabular-nums text-[var(--muted)]">
                {me.gwPoints} : {rival.gwPoints}
              </div>
            </div>
            <div className="rounded-md bg-[var(--bg)] px-2 py-2">
              <div className="text-caption text-[var(--muted)]">{tr("총점", "Total")}</div>
              <div className={`text-lg font-bold tabular-nums ${gapTone(gap.totalGap)}`}>{signed(gap.totalGap)}</div>
              <div className="text-caption tabular-nums text-[var(--muted)]">
                {me.projectedTotalPoints} : {rival.projectedTotalPoints}
              </div>
            </div>
            <div className="rounded-md bg-[var(--bg)] px-2 py-2">
              <div className="text-caption text-[var(--muted)]">{tr("순위", "Rank")}</div>
              <div className={`text-lg font-bold tabular-nums ${gapTone(gap.rankGap)}`}>
                {me.projectedRank} : {rival.projectedRank}
              </div>
              <div className="text-caption text-[var(--muted)]">{tr("잠정", "live")}</div>
            </div>
          </div>
          <p className="text-caption text-[var(--muted)]">
            {tr("주장", "Captains")}: <b className="text-[var(--text)]">{me.captainName}</b> vs{" "}
            <b className="text-[var(--text)]">{rival.captainName}</b>
            {gap.captainDiff ? <span className="ml-1 font-semibold text-amber-700">{tr("· 주장 다름", "· differs")}</span> : null}
          </p>
          <div className="grid grid-cols-2 gap-2 text-caption">
            {(
              [
                [tr("나만 선발", "Only mine"), gap.myOnly],
                [tr("라이벌만 선발", "Only rival's"), gap.rivalOnly]
              ] as const
            ).map(([label, list]) => (
              <div key={label} className="rounded-md bg-[var(--bg)] px-2 py-1.5">
                <div className="mb-1 text-caption font-semibold text-[var(--muted)]">{label}</div>
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
      ) : null}
    </section>
  );
}
