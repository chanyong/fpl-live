/**
 * Starting XI and bench candidates for a 15-player squad (issue #43, stage 1-A).
 *
 * FPL allows 1 GK, 3-5 DEF, 2-5 MID, 1-3 FWD, 11 in all: eight formations. Each is solved exactly (best
 * players of each position by xP), and the three with the largest total are returned as L1, L2, L3. Ties
 * (same xP) always go to the lower player ID, and equal formation totals to the formation listed first, so the
 * same input gives the same answer every time.
 */
export type LineupPlayer = {
  id: number;
  /** FPL element_type: 1 GK, 2 DEF, 3 MID, 4 FWD. */
  elementType: number;
  /** xP of the target gameweek. */
  xp: number;
  /** True when the player is in the current (last deadline) starting XI. */
  isStarter: boolean;
};

export type LineupChange = { out: number; in: number };

export type LineupCandidate = {
  /** 1 for the recommended one, 2 and 3 for the runners-up. */
  rank: number;
  /** "3-4-3": defenders-midfielders-forwards. */
  formation: string;
  /** Eleven IDs, goalkeeper first, then DEF, MID, FWD, each group by xP. */
  starters: number[];
  /** FPL bench order: the spare goalkeeper first, then three outfield players by xP. */
  bench: number[];
  /** Sum of the starters' xP. */
  expectedPoints: number;
  /** Starters' xP sum of the squad's current XI, and the gain over it. */
  currentExpectedPoints: number;
  gain: number;
  /** Slots that differ from the current XI, paired by position where possible. */
  changes: LineupChange[];
};

export const FORMATIONS: ReadonlyArray<readonly [number, number, number]> = [
  [3, 4, 3],
  [3, 5, 2],
  [4, 3, 3],
  [4, 4, 2],
  [4, 5, 1],
  [5, 2, 3],
  [5, 3, 2],
  [5, 4, 1]
];

/** Sums are compared at 1e-9 so floating-point noise never decides a tie. */
function scaled(value: number) {
  return Math.round(value * 1e9);
}

function byXpThenId(a: LineupPlayer, b: LineupPlayer) {
  return scaled(b.xp) - scaled(a.xp) || a.id - b.id;
}

function pairChanges(out: LineupPlayer[], incoming: LineupPlayer[]): LineupChange[] {
  const remainingIn = [...incoming];
  const pairs: LineupChange[] = [];
  const unmatched: LineupPlayer[] = [];

  for (const leaving of out) {
    const index = remainingIn.findIndex((player) => player.elementType === leaving.elementType);
    if (index >= 0) {
      pairs.push({ out: leaving.id, in: remainingIn[index].id });
      remainingIn.splice(index, 1);
    } else {
      unmatched.push(leaving);
    }
  }
  // A formation change swaps positions (a defender out, a midfielder in): pair what is left in order.
  unmatched.forEach((leaving, index) => {
    if (remainingIn[index]) pairs.push({ out: leaving.id, in: remainingIn[index].id });
  });

  return pairs;
}

export function buildLineups(squad: LineupPlayer[], limit = 3): LineupCandidate[] {
  const groups = new Map<number, LineupPlayer[]>();
  for (const type of [1, 2, 3, 4]) {
    groups.set(type, squad.filter((player) => player.elementType === type).sort(byXpThenId));
  }
  const [gks, defs, mids, fwds] = [1, 2, 3, 4].map((type) => groups.get(type) ?? []);
  const current = squad.filter((player) => player.isStarter);
  const currentSum = current.reduce((sum, player) => sum + player.xp, 0);

  const built: Array<{ formation: readonly [number, number, number]; order: number; starters: LineupPlayer[]; sum: number }> = [];
  FORMATIONS.forEach((formation, order) => {
    const [d, m, f] = formation;
    if (gks.length < 1 || defs.length < d || mids.length < m || fwds.length < f) {
      return;
    }
    const starters = [...gks.slice(0, 1), ...defs.slice(0, d), ...mids.slice(0, m), ...fwds.slice(0, f)];
    built.push({ formation, order, starters, sum: starters.reduce((sum, player) => sum + player.xp, 0) });
  });

  built.sort((a, b) => scaled(b.sum) - scaled(a.sum) || a.order - b.order);

  return built.slice(0, limit).map((item, index) => {
    const chosen = new Set(item.starters.map((player) => player.id));
    const rest = squad.filter((player) => !chosen.has(player.id));
    const benchGk = rest.filter((player) => player.elementType === 1).sort(byXpThenId);
    const benchField = rest.filter((player) => player.elementType !== 1).sort(byXpThenId);
    const out = current.filter((player) => !chosen.has(player.id)).sort((a, b) => a.id - b.id);
    const incoming = item.starters.filter((player) => !current.some((cur) => cur.id === player.id));

    return {
      rank: index + 1,
      formation: item.formation.join("-"),
      starters: item.starters.map((player) => player.id),
      bench: [...benchGk, ...benchField.slice(0, 3)].map((player) => player.id),
      expectedPoints: item.sum,
      currentExpectedPoints: currentSum,
      gain: item.sum - currentSum,
      changes: pairChanges(out, incoming)
    };
  });
}
