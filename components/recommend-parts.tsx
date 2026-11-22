"use client";

import type { ReactNode } from "react";
import { useLocale } from "@/components/locale-provider";
import { INTL_TAG, type Locale } from "@/lib/locale";
import { formatMoney } from "@/lib/season-summary";
import type { EntryRecommendPayload } from "@/lib/xp/recommend";

/** Small pieces shared by the rules-based and the AI panels of /team/[id] (issue #43, stage 4). */

export const fmtXp = (value: number) => value.toFixed(1);
export const fmtSigned = (value: number) => `${value >= 0 ? "+" : "-"}${Math.abs(value).toFixed(1)}`;
export const fmtMoney = (tenths: number) => formatMoney(tenths);

export function fmtTime(ms: number | string | null | undefined, locale: Locale) {
  if (ms === null || ms === undefined) return "-";
  const date = new Date(ms);
  if (!Number.isFinite(date.getTime())) return "-";
  return new Intl.DateTimeFormat(INTL_TAG[locale], { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
}

export type PlayerShown = { name: string; club: string | null; position: string | null; cost: number | null };

/** Looks a player up in the squad, then in the scenario players the route added; null when unknown. */
export function playerLookup(payload: Pick<EntryRecommendPayload, "players" | "playerInfo">) {
  const own = new Map(payload.players.map((player) => [player.elementId, player]));
  return (id: number): PlayerShown => {
    const mine = own.get(id);
    if (mine) return { name: mine.webName, club: mine.teamShortName, position: mine.position, cost: null };
    const info = payload.playerInfo?.[String(id)];
    if (info) return { name: info.webName, club: info.teamShortName, position: info.position, cost: info.nowCost };
    return { name: `#${id}`, club: null, position: null, cost: null };
  };
}

export function PlayerTag({ player, showCost = false }: { player: PlayerShown; showCost?: boolean }) {
  const meta = [player.club, player.position, showCost && player.cost ? fmtMoney(player.cost) : null].filter(Boolean).join(" · ");
  return (
    <span className="min-w-0 break-words">
      <span className="font-semibold">{player.name}</span>
      {meta ? <span className="text-caption text-[var(--muted)]"> ({meta})</span> : null}
    </span>
  );
}

export function SubHeading({ children }: { children: ReactNode }) {
  return <h3 className="text-body-lg font-semibold">{children}</h3>;
}

export function Badge({ children, tone = "plain" }: { children: ReactNode; tone?: "plain" | "accent" | "warn" }) {
  const toneClass =
    tone === "accent"
      ? "bg-[var(--accent-soft)] text-[var(--accent-ink)]"
      : tone === "warn"
        ? "bg-[var(--surface-strong)] text-[var(--warning)]"
        : "bg-[var(--surface-strong)] text-[var(--muted)]";
  return <span className={`inline-block rounded-sm px-1.5 py-0.5 text-caption font-semibold ${toneClass}`}>{children}</span>;
}

/** "ARS (H)" for one fixture, both for a double, a word for a blank. */
export function FixtureText({ fixtures }: { fixtures: Array<{ opponent: string; home: boolean }> }) {
  const { tr } = useLocale();
  if (fixtures.length === 0) return <>{tr("경기 없음", "No game")}</>;
  return <>{fixtures.map((fixture) => `${fixture.opponent} (${fixture.home ? "H" : "A"})`).join(" · ")}</>;
}
