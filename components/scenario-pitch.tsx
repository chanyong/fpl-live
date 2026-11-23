"use client";

import { useLocale } from "@/components/locale-provider";
import { Badge, fmtXp } from "@/components/recommend-parts";
import { SquadPitch } from "@/components/squad-pitch";
import type { FplPosition } from "@/lib/types";
import type { SquadPlayer } from "@/lib/squad-types";
import type { EntryRecommendPayload, ScenarioLineup } from "@/lib/xp/recommend";

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
      fixtures: card?.fixtures ?? []
    };
  });
}

export function ScenarioPitch({
  lineup,
  cards,
  label,
  isRoll,
  reasons
}: {
  lineup: ScenarioLineup;
  cards: NonNullable<EntryRecommendPayload["lineupPlayers"]>;
  label: string;
  isRoll: boolean;
  reasons?: Record<number, string>;
}) {
  const { tr } = useLocale();
  const squad = scenarioSquad(lineup, cards);
  const newIds = new Set(lineup.incoming);

  return (
    <div className="flex flex-col gap-1.5" data-scenario-pitch>
      <p className="flex flex-wrap items-center gap-1.5 text-body">
        <span className="font-semibold">{tr(`${label} 기준 선발·벤치`, `XI and bench: ${label}`)}</span>
        <span className="tabular-nums">{tr(`포메이션 ${lineup.formation} · 선발 기대 점수 ${fmtXp(lineup.expectedPoints)}`, `Formation ${lineup.formation} · XI xP ${fmtXp(lineup.expectedPoints)}`)}</span>
        {isRoll ? null : <Badge tone="accent">{tr("IN = 새로 영입", "IN = new signing")}</Badge>}
      </p>
      <SquadPitch
        squad={squad}
        metric="opponent"
        extras={{ newIds, reasons, below: (player) => tr(`기대 ${fmtXp(cards[String(player.elementId)]?.xpNext ?? 0)}`, `xP ${fmtXp(cards[String(player.elementId)]?.xpNext ?? 0)}`) }}
      />
    </div>
  );
}
