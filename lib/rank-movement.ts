import type { LeagueRow } from "@/lib/types";

export type RankMove = {
  entryId: number;
  managerName: string;
  teamName: string;
  from: number;
  to: number;
  /** Positive = climbed. */
  delta: number;
  gwPoints: number;
};

export type RankMovementSummary = {
  risers: RankMove[];
  fallers: RankMove[];
  topScorer: { managerName: string; teamName: string; gwPoints: number } | null;
  /** Managers whose place changed at all. */
  movedCount: number;
  comparable: number;
};

/**
 * This gameweek's movement: rank when the previous gameweek closed (FPL `last_rank`) against the
 * live projected rank. Once every match is over that is the post-gameweek change.
 */
export function summarizeRankMovement(rows: LeagueRow[], limit = 3): RankMovementSummary {
  const moves: RankMove[] = rows
    .filter((row) => typeof row.lastRank === "number" && row.lastRank > 0)
    .map((row) => ({
      entryId: row.entryId,
      managerName: row.managerName,
      teamName: row.teamName,
      from: row.lastRank as number,
      to: row.projectedRank,
      delta: (row.lastRank as number) - row.projectedRank,
      gwPoints: row.gwPoints
    }));

  const risers = moves
    .filter((move) => move.delta > 0)
    .sort((a, b) => b.delta - a.delta || a.to - b.to)
    .slice(0, limit);
  const fallers = moves
    .filter((move) => move.delta < 0)
    .sort((a, b) => a.delta - b.delta || a.to - b.to)
    .slice(0, limit);

  const top = [...rows].sort((a, b) => b.gwPoints - a.gwPoints)[0];

  return {
    risers,
    fallers,
    topScorer: top ? { managerName: top.managerName, teamName: top.teamName, gwPoints: top.gwPoints } : null,
    movedCount: moves.filter((move) => move.delta !== 0).length,
    comparable: moves.length
  };
}

export type RivalGap = {
  /** me − rival; positive = I'm ahead. */
  gwGap: number;
  totalGap: number;
  rankGap: number;
  myOnly: Array<{ elementId: number; webName: string; livePoints: number }>;
  rivalOnly: Array<{ elementId: number; webName: string; livePoints: number }>;
  /** Players both field in the XI but one of them captains. */
  captainDiff: boolean;
};

/** Head-to-head between two managers on the live numbers; only starting XIs count as differentials. */
export function computeRivalGap(me: LeagueRow, rival: LeagueRow): RivalGap {
  const myXi = new Map(me.squad.starters.map((player) => [player.elementId, player]));
  const rivalXi = new Map(rival.squad.starters.map((player) => [player.elementId, player]));
  const pick = (player: { elementId: number; webName: string; livePoints: number }) => ({
    elementId: player.elementId,
    webName: player.webName,
    livePoints: player.livePoints
  });
  const byPoints = (a: { livePoints: number }, b: { livePoints: number }) => b.livePoints - a.livePoints;

  const myCaptain = me.squad.starters.find((player) => player.isCaptain)?.elementId;
  const rivalCaptain = rival.squad.starters.find((player) => player.isCaptain)?.elementId;

  return {
    gwGap: me.gwPoints - rival.gwPoints,
    totalGap: me.projectedTotalPoints - rival.projectedTotalPoints,
    rankGap: rival.projectedRank - me.projectedRank,
    myOnly: [...myXi.values()].filter((player) => !rivalXi.has(player.elementId)).map(pick).sort(byPoints),
    rivalOnly: [...rivalXi.values()].filter((player) => !myXi.has(player.elementId)).map(pick).sort(byPoints),
    captainDiff: myCaptain !== undefined && rivalCaptain !== undefined && myCaptain !== rivalCaptain
  };
}
