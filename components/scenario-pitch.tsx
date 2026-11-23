"use client";

import { FdrHorizonToggle } from "@/components/fdr-cells";
import { useLocale } from "@/components/locale-provider";
import { Badge, fmtXp } from "@/components/recommend-parts";
import { SquadPitch } from "@/components/squad-pitch";
import type { FplPosition } from "@/lib/types";
import type { FdrHorizon } from "@/lib/squad-view";
import type { SquadPlayer } from "@/lib/squad-types";
import { POSITION_ORDER } from "@/lib/xp/chip-explain";
import { buildLineupReasons, type LineupMove, type LineupReason } from "@/lib/xp/lineup-reasons";
import type { EntryRecommendPayload, ScenarioLineup } from "@/lib/xp/recommend";

/** Issue #83: the "why starts / sits" list, grouped by position; the roll pitch and the "recommended XI" section share it. */
export function LineupReasonList({ reasons }: { reasons: LineupReason[] }) {
  const { tr } = useLocale();
  if (reasons.length === 0) return null;
  const armband = reasons.filter((reason) => reason.kind === "captain" || reason.kind === "vice");
  const moves = reasons.filter((reason) => reason.kind === "in");
  return (
    <details className="rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 py-1" data-lineup-reasons>
      <summary className="cursor-pointer text-meta font-semibold">{tr("선발·벤치 이유", "Why these starters and bench")}</summary>
      <div className="mt-1 flex flex-col gap-1.5 text-caption leading-snug">
        {moves.length > 0 ? (
          <ul className="flex list-none flex-col gap-0.5 p-0" data-reason-group="in">
            {moves.map((reason) => (
              <li key={`in-${reason.id}`} className="break-words">{reason.text}</li>
            ))}
          </ul>
        ) : null}
        {armband.length > 0 ? (
          <ul className="flex list-none flex-col gap-0.5 p-0" data-reason-group="captain">
            {armband.map((reason) => (
              <li key={`${reason.kind}-${reason.id}`} className="break-words">{reason.text}</li>
            ))}
          </ul>
        ) : null}
        {POSITION_ORDER.map((position) => {
          const rows = reasons.filter((reason) => (reason.kind === "starter" || reason.kind === "bench") && reason.position === position);
          if (rows.length === 0) return null;
          return (
            <div key={position} data-reason-group={position}>
              <p className="font-semibold">{position}</p>
              <ul className="flex list-none flex-col gap-0.5 p-0">
                {rows.map((reason) => (
                  <li key={`${reason.kind}-${reason.id}`} className="break-words" data-reason-kind={reason.kind}>{reason.text}</li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </details>
  );
}

/** Issue #61: the squad as one transfer scenario leaves it, drawn with the "my squad" pitch. */
export function scenarioSquad(lineup: ScenarioLineup, cards: NonNullable<EntryRecommendPayload["lineupPlayers"]>): SquadPlayer[] {
  const ordered = [...lineup.starters, ...lineup.bench];
  return ordered.map((id, index) => {
    const card = cards[String(id)];
    return {
      elementId: id,
      webName: card?.webName ?? `#${id}`,
      teamShortName: card?.teamShortName ?? "-",
      teamCode: 0,
      position: (card?.position ?? "MID") as FplPosition,
      pickPosition: index + 1,
      isStarter: index < 11,
      isCaptain: id === lineup.captainId,
      isViceCaptain: id === lineup.viceCaptainId,
      photoUrl: card?.photoUrl ?? null,
      status: card?.status ?? "a",
      news: card?.news ?? "",
      nowCost: 0,
      purchaseCost: null,
      sellingPrice: null,
      costChangeEvent: 0,
      costChangeStart: 0,
      form: 0,
      selectedByPercent: 0,
      eventPoints: null,
      fixtures: card?.fixtures ?? [],
      outlook: card?.outlook
    };
  });
}

export function ScenarioPitch({
  lineup,
  cards,
  label,
  isRoll,
  reasons,
  moves,
  fdrHorizon = 3,
  onFdrHorizon
}: {
  lineup: ScenarioLineup;
  cards: NonNullable<EntryRecommendPayload["lineupPlayers"]>;
  label: string;
  isRoll: boolean;
  reasons?: Record<number, string>;
  /** Issue #83: who each signing replaces (transfer scenarios; the chips use `reasons`). */
  moves?: LineupMove[];
  fdrHorizon?: FdrHorizon;
  onFdrHorizon?: (next: FdrHorizon) => void;
}) {
  const { tr, locale } = useLocale();
  const squad = scenarioSquad(lineup, cards);
  const newIds = new Set(lineup.incoming);
  const lineupReasons = buildLineupReasons(lineup, cards, locale, moves);
  // Chip scenarios already carry a per-signing line (issue #69): it replaces the generic IN line.
  const shownReasons = reasons
    ? [...lineupReasons.filter((reason) => !(reason.kind === "in" && reasons[reason.id])), ...lineup.incoming.filter((id) => reasons[id]).map((id) => ({ id, kind: "in" as const, position: cards[String(id)]?.position ?? "MID", text: `${cards[String(id)]?.webName ?? `#${id}`} IN — ${reasons[id]}` }))]
    : lineupReasons;
  const tip: Record<number, string> = {};
  for (const reason of shownReasons) {
    if (reason.kind === "starter" || reason.kind === "bench") tip[reason.id] = reason.text;
  }
  for (const reason of shownReasons) {
    if (reason.kind === "in") tip[reason.id] = [reasons?.[reason.id] ?? reason.text, tip[reason.id]].filter(Boolean).join(" · ");
  }

  return (
    <div className="flex flex-col gap-1.5" data-scenario-pitch>
      <p className="flex flex-wrap items-center gap-1.5 text-body">
        <span className="font-semibold">{tr(`${label} 기준 선발·벤치`, `XI and bench: ${label}`)}</span>
        <span className="tabular-nums">{tr(`포메이션 ${lineup.formation} · 선발 기대 점수 ${fmtXp(lineup.expectedPoints)}`, `Formation ${lineup.formation} · XI xP ${fmtXp(lineup.expectedPoints)}`)}</span>
        {isRoll ? null : <Badge tone="accent">{tr("IN = 새로 영입", "IN = new signing")}</Badge>}
      </p>
      {onFdrHorizon ? (
        <div className="flex items-center gap-2 text-meta text-[var(--muted)]">
          <span>{tr("상대 난이도(FDR)", "Opponent difficulty (FDR)")}</span>
          <FdrHorizonToggle horizon={fdrHorizon} onChange={onFdrHorizon} />
        </div>
      ) : null}
      <SquadPitch
        squad={squad}
        metric="fdr"
        horizon={fdrHorizon}
        extras={{ newIds, reasons: tip, below: (player) => tr(`기대 ${fmtXp(cards[String(player.elementId)]?.xpNext ?? 0)}`, `xP ${fmtXp(cards[String(player.elementId)]?.xpNext ?? 0)}`) }}
      />
      <LineupReasonList reasons={shownReasons} />
    </div>
  );
}
