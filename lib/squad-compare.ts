import type { FplPosition, LeagueRow, PlayerLiveCard } from "@/lib/types";

export const COMPARE_POSITIONS: FplPosition[] = ["GKP", "DEF", "MID", "FWD"];

export type PositionComparison = {
  position: FplPosition;
  onlyA: PlayerLiveCard[];
  shared: PlayerLiveCard[];
  onlyB: PlayerLiveCard[];
};

export type SquadComparison = {
  positions: PositionComparison[];
  sharedCount: number;
  onlyACount: number;
  onlyBCount: number;
};

function fullSquad(row: LeagueRow): PlayerLiveCard[] {
  return [...row.squad.starters, ...row.squad.bench];
}

function byPointsThenName(a: PlayerLiveCard, b: PlayerLiveCard) {
  return b.livePoints - a.livePoints || a.webName.localeCompare(b.webName);
}

/** Gameweek points each position contributed, with captain multipliers and an empty bench. */
export function pointsByPosition(row: LeagueRow): Record<FplPosition, number> {
  const totals: Record<FplPosition, number> = { GKP: 0, DEF: 0, MID: 0, FWD: 0 };

  for (const player of row.squad.starters) {
    totals[player.position] += player.livePoints * player.multiplier;
  }

  return totals;
}

/** Splits two managers' fifteen into shared / exclusive players, grouped by position. */
export function compareSquads(a: LeagueRow, b: LeagueRow): SquadComparison {
  const squadA = new Map(fullSquad(a).map((player) => [player.elementId, player]));
  const squadB = new Map(fullSquad(b).map((player) => [player.elementId, player]));

  const positions = COMPARE_POSITIONS.map((position): PositionComparison => {
    const inPosition = (player: PlayerLiveCard) => player.position === position;

    return {
      position,
      onlyA: [...squadA.values()]
        .filter((player) => inPosition(player) && !squadB.has(player.elementId))
        .sort(byPointsThenName),
      shared: [...squadA.values()]
        .filter((player) => inPosition(player) && squadB.has(player.elementId))
        .sort(byPointsThenName),
      onlyB: [...squadB.values()]
        .filter((player) => inPosition(player) && !squadA.has(player.elementId))
        .sort(byPointsThenName)
    };
  });

  return {
    positions,
    sharedCount: positions.reduce((sum, group) => sum + group.shared.length, 0),
    onlyACount: positions.reduce((sum, group) => sum + group.onlyA.length, 0),
    onlyBCount: positions.reduce((sum, group) => sum + group.onlyB.length, 0)
  };
}
