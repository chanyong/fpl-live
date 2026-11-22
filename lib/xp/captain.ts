/**
 * Captain candidates (issue #43, stage 1-A): the five highest-xP players of the recommended starting XI.
 *
 * `weightPct` is an "추천 비중" (recommendation weight), NOT a probability: exp(xP / tau) over the five,
 * shown as whole percents that add up to exactly 100 (largest remainder). tau is a starting value that has
 * not been checked against past gameweeks; until the backtest fits it, the number must not be presented as
 * the chance of being the top scorer.
 */
export const CAPTAIN_TAU = 1.5;
export const CAPTAIN_CANDIDATES = 5;

export type CaptainInput = {
  id: number;
  /** xP of the target gameweek. */
  xp: number;
  /** Opponents of the target gameweek (two for a double, none for a blank). */
  fixtures: Array<{ opponent: string; home: boolean }>;
  /** Overall ownership, percent. */
  selectedByPercent: number;
};

export type CaptainCandidate = CaptainInput & { rank: number; weightPct: number };

/** Whole-percent shares of `values` that sum to exactly 100, remainders given out largest first (ties: earlier). */
export function percentShares(values: number[]) {
  const total = values.reduce((sum, value) => sum + value, 0);
  if (values.length === 0 || !(total > 0)) {
    return values.map(() => 0);
  }
  const exact = values.map((value) => (value / total) * 100);
  const shares = exact.map((value) => Math.floor(value + 1e-9));
  let left = 100 - shares.reduce((sum, share) => sum + share, 0);
  const order = exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value + 1e-9) }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (const item of order) {
    if (left <= 0) break;
    shares[item.index] += 1;
    left -= 1;
  }
  return shares;
}

/** exp(xP / tau) shares of the given xP values, in whole percents summing to 100. */
export function captainWeights(xps: number[], tau = CAPTAIN_TAU) {
  if (xps.length === 0) {
    return [];
  }
  // Shift by the maximum so a large xP cannot overflow exp().
  const top = Math.max(...xps);
  return percentShares(xps.map((xp) => Math.exp((xp - top) / tau)));
}

/** `starters` are the recommended XI (L1). Highest xP first; equal xP goes to the lower player ID. */
export function buildCaptainCandidates(starters: CaptainInput[]): CaptainCandidate[] {
  const picked = [...starters]
    .sort((a, b) => Math.round(b.xp * 1e9) - Math.round(a.xp * 1e9) || a.id - b.id)
    .slice(0, CAPTAIN_CANDIDATES);
  const weights = captainWeights(picked.map((player) => player.xp));
  return picked.map((player, index) => ({ ...player, rank: index + 1, weightPct: weights[index] }));
}
