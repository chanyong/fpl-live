import type { ChipStatus } from "@/lib/chip-availability";
import { transferCost } from "@/lib/free-transfers";
import { FORMATIONS } from "@/lib/xp/lineup";
import { XP_PARAMS, type XpTable } from "@/lib/xp/model";

/**
 * Transfer scenarios for one 15-player squad (issue #43, stage 1-B). Rules and arithmetic only: no AI, no
 * database, no screen. The same input always gives the same answer (ties go to the lower player IDs).
 *
 * Value of a squad over a horizon of N gameweeks:
 *
 *   value = sum over gameweeks g of  w[g] x ( XI(g) + BENCH_WEIGHT x bench(g) )
 *
 * XI(g) is the best starting XI of that week (the eight formations of lineup.ts, solved exactly), bench(g) the
 * xP of the four who are left, w[g] the discount of the xP model (1.0, 0.9, 0.8 ...). A scenario's "net gain" is
 * its value minus the transfer cost (4 points per transfer beyond the free ones) minus the value of rolling
 * (making no transfer).
 *
 * Money is whole tenths of a million (integers): the budget is selling prices of the 15 plus the bank, and a
 * squad is legal when it costs no more than that, has at most 3 players per club and keeps 2 GK, 5 DEF, 5 MID,
 * 3 FWD (a transfer swaps within the same position).
 *
 * The 1- and 2-transfer lists are exact inside the candidate pool (the 2-transfer search prunes pairs with a
 * provable upper bound, so it never loses a better pair). Wildcard and Free Hit are greedy + swap improvement:
 * good, not guaranteed optimal, and marked `optimal: false`.
 *
 * The search is split into slices: after about `sliceMs` of work it yields to the event loop (setImmediate), so
 * a 100,000-pair search never freezes the server for a whole second.
 */
export const TRANSFER_PARAMS = {
  /** Weight of the bench's xP in the value (the starting XI counts 1). */
  benchWeight: 0.1,
  /** Below this net gain over rolling, "roll" is recommended (a -4 is not worth a gain smaller than the forecast error). */
  minNetGain: 2,
  /**
   * A chip is used once a season half, so beating "roll" is not enough to recommend it: its net gain must also
   * beat this opportunity cost. Only the recommendation uses it; the displayed net gain is the raw figure.
   */
  chipOpportunityCost: 10,
  /** Candidates per position, and how the pool is filled before it is topped up by xP. */
  poolPerPosition: 30,
  poolXpTop: 18,
  poolFormTop: 6,
  poolRisingTop: 4,
  poolRivalTop: 4,
  /** Scenarios kept for 1 transfer and for 2 transfers. */
  topN: 5,
  /** Work done before yielding to the event loop. */
  sliceMs: 8,
  /** Spare money (tenths) at or below which a scenario is flagged: selling-price errors are 0.1 sized. */
  tightBank: 1
} as const;

export type TransferHorizon = 3 | 5;
export type ScenarioType = "roll" | "one" | "two" | "wildcard" | "freehit";

export type TransferSquadPlayer = {
  id: number;
  /** FPL element_type: 1 GK, 2 DEF, 3 MID, 4 FWD. */
  elementType: number;
  teamId: number;
  /** Estimated selling price, tenths; null when unknown (the current price is used and the result flagged). */
  sellingPrice: number | null;
  /** Current price, tenths. */
  nowCost: number;
};

export type ChipAvailability = { available: true } | { available: false; reason: string };

export type TransferSearchInput = {
  /** The 15. */
  squad: TransferSquadPlayer[];
  /** Tenths of a million. */
  bank: number;
  /** Estimated free transfers for the next gameweek; null = unknown (1 is used and the result flagged). */
  freeTransfers: number | null;
  /** True when the rebuilt free-transfer history disagreed with a recorded cost. */
  freeTransfersUnreliable?: boolean;
  table: XpTable;
  horizon: TransferHorizon;
  chips: { wildcard: ChipAvailability; freehit: ChipAvailability };
  /** Players the league rivals hold (candidate pool); may be empty. */
  rivalOwnedIds?: number[];
};

export type TransferScenario = {
  /** Content-based and stable: "roll", "one:out>in", "two:a+b>x+y", "wildcard", "freehit". */
  id: string;
  type: ScenarioType;
  /** Player IDs leaving and arriving, each ascending. */
  out: number[];
  in: number[];
  /** Starting-XI xP of the next gameweek / discounted over the horizon, for the squad after the move (before the transfer cost). */
  nextGwXp: number;
  periodXp: number;
  /** Points paid for the transfers (0 for roll and the chips). */
  transferCost: number;
  /** Value minus cost minus the value of rolling (bench counted at BENCH_WEIGHT); 0 for roll. */
  netGain: number;
  /** Tenths of a million left after the move (the bank for roll). */
  bankAfter: number;
  /** True when the spare money is 0.1 or less: a selling-price estimate off by 0.1 would make it illegal. */
  budgetTight: boolean;
  /** Some player involved had no selling price and the current price was used. */
  sellingPriceEstimated: boolean;
  /** The cost depends on a free-transfer count that was unknown (1 assumed). */
  freeTransfersEstimated: boolean;
  /** True when the list is exact inside the pool; false for the greedy chip optimisation. */
  optimal: boolean;
};

export type TransferSearchResult = {
  horizon: TransferHorizon;
  /** Gameweeks actually summed: the horizon, or fewer near the end of the season. */
  gws: number[];
  /** Candidates searched (all positions together, own squad not counted). */
  poolSize: number;
  scenarios: TransferScenario[];
  /** ID of the recommended scenario: the best net gain, or "roll" when no gain reaches the threshold. */
  recommendedId: string;
  /** Chips left out and why (reason code). */
  skipped: Array<{ type: "wildcard" | "freehit"; reason: string }>;
  bank: number;
  /** Selling prices + bank, tenths. */
  budget: number;
  /** Free transfers the costs were computed with. */
  freeTransfers: number;
  estimates: {
    sellingPriceFallback: boolean;
    freeTransfersFallback: boolean;
    freeTransfersUnreliable: boolean;
  };
  params: { benchWeight: number; minNetGain: number; chipOpportunityCost: number };
};

export type TransferSearchStats = {
  evaluations: number;
  slices: number;
  /** Longest stretch of work between two yields, ms. */
  maxSliceMs: number;
  elapsedMs: number;
  twoTransferEvaluations: number;
};

export type TransferSearchOptions = {
  sliceMs?: number;
  /** Value every legal pair instead of pruning by the upper bound: same answer, the worst-case cost (diagnostics and tests). */
  exhaustive?: boolean;
  /** Replaces setImmediate (tests). */
  yieldToLoop?: () => Promise<void>;
  now?: () => number;
};

const EPS = 1e-9;
const scaled = (value: number) => Math.round(value * 1e9);

// ---------------------------------------------------------------------------------------------------------------
// Chips

/** Wildcard / Free Hit playable in `nextGw`, or the reason they are not (a code, not a sentence). */
export function chipAvailability(chips: ChipStatus[], nextGw: number | null, name: "wildcard" | "freehit"): ChipAvailability {
  const windows = chips.filter((chip) => chip.name === name);
  if (windows.length === 0) {
    return { available: false, reason: "chip_not_in_season" };
  }
  if (windows.some((chip) => chip.state.kind === "available")) {
    return { available: true };
  }
  const here = nextGw === null ? [] : windows.filter((chip) => nextGw >= chip.startEvent && nextGw <= chip.stopEvent);
  if (here.some((chip) => chip.state.kind === "used")) {
    return { available: false, reason: "chip_used" };
  }
  if (windows.some((chip) => chip.state.kind === "later")) {
    return { available: false, reason: "chip_not_open" };
  }
  return { available: false, reason: "chip_expired" };
}

// ---------------------------------------------------------------------------------------------------------------
// Slicing: yield to the event loop every few milliseconds.

class Slicer {
  slices = 0;
  maxSliceMs = 0;
  private start: number;
  private ticks = 0;

  constructor(
    private readonly sliceMs: number,
    private readonly now: () => number,
    private readonly wait: () => Promise<void>
  ) {
    this.start = now();
  }

  /** Cheap: reads the clock only every 64th call. */
  due() {
    this.ticks += 1;
    return (this.ticks & 63) === 0 && this.now() - this.start >= this.sliceMs;
  }

  async yield() {
    this.slices += 1;
    this.maxSliceMs = Math.max(this.maxSliceMs, this.now() - this.start);
    await this.wait();
    this.start = this.now();
  }

  finish() {
    this.maxSliceMs = Math.max(this.maxSliceMs, this.now() - this.start);
  }
}

function defaultWait(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof setImmediate === "function") setImmediate(resolve);
    else setTimeout(resolve, 0);
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Squad value

type Cand = {
  id: number;
  type: number;
  team: number;
  /** Own player: selling price. Anyone else: current price. Tenths. */
  cost: number;
  own: boolean;
  /** xP of each gameweek of the horizon. */
  xp: Float64Array;
};

const gk = new Float64Array(16);
const df = new Float64Array(16);
const md = new Float64Array(16);
const fw = new Float64Array(16);
const lists = [gk, gk, df, md, fw];
const counts = new Int32Array(5);
const pd = new Float64Array(17);
const pm = new Float64Array(17);
const pf = new Float64Array(17);
let lastXi = 0;
let lastTotal = 0;

/**
 * Weighted best-XI sum and weighted all-15 sum of a squad (indices into `cands`) into lastXi / lastTotal; returns
 * the value. Allocation-free: this is the inner loop of the 2-transfer search.
 */
function score(cands: Cand[], squad: ArrayLike<number>, weights: Float64Array) {
  let xi = 0;
  let total = 0;

  for (let g = 0; g < weights.length; g += 1) {
    const weight = weights[g];
    if (weight === 0) continue;

    counts[1] = counts[2] = counts[3] = counts[4] = 0;
    let all = 0;
    for (let slot = 0; slot < squad.length; slot += 1) {
      const cand = cands[squad[slot]];
      const x = cand.xp[g];
      all += x;
      const list = lists[cand.type];
      let j = counts[cand.type]++;
      while (j > 0 && list[j - 1] < x) {
        list[j] = list[j - 1];
        j -= 1;
      }
      list[j] = x;
    }
    pd[0] = pm[0] = pf[0] = 0;
    for (let k = 0; k < counts[2]; k += 1) pd[k + 1] = pd[k] + df[k];
    for (let k = 0; k < counts[3]; k += 1) pm[k + 1] = pm[k] + md[k];
    for (let k = 0; k < counts[4]; k += 1) pf[k + 1] = pf[k] + fw[k];

    let best = 0;
    if (counts[1] >= 1) {
      let found = false;
      for (const [d, m, f] of FORMATIONS) {
        if (counts[2] >= d && counts[3] >= m && counts[4] >= f) {
          const sum = gk[0] + pd[d] + pm[m] + pf[f];
          if (!found || sum > best) {
            best = sum;
            found = true;
          }
        }
      }
    }
    xi += weight * best;
    total += weight * all;
  }

  lastXi = xi;
  lastTotal = total;
  return xi * (1 - TRANSFER_PARAMS.benchWeight) + total * TRANSFER_PARAMS.benchWeight;
}

// ---------------------------------------------------------------------------------------------------------------
// Candidate pool

type PoolPlayer = { id: number; weighted: number; form: number; rising: number };

function buildPool(table: XpTable, weights: Float64Array, ownIds: Set<number>, rival: Set<number>) {
  const byType = new Map<number, PoolPlayer[]>([[1, []], [2, []], [3, []], [4, []]]);
  for (const player of table.players.values()) {
    if (ownIds.has(player.id) || player.availability <= 0 || player.status === XP_PARAMS.goneStatus) continue;
    const list = byType.get(player.elementType);
    if (!list) continue;
    let weighted = 0;
    for (let g = 0; g < weights.length; g += 1) weighted += weights[g] * (player.weeks[g]?.xp ?? 0);
    if (!(weighted > 0)) continue;
    list.push({ id: player.id, weighted, form: player.form, rising: player.priceLikelihood });
  }

  const pool = new Map<number, number[]>();
  for (const [type, list] of byType) {
    const byXp = [...list].sort((a, b) => scaled(b.weighted) - scaled(a.weighted) || a.id - b.id);
    const byForm = [...list].sort((a, b) => scaled(b.form) - scaled(a.form) || a.id - b.id);
    const rising = list
      .filter((player) => player.rising >= 4)
      .sort((a, b) => b.rising - a.rising || scaled(b.weighted) - scaled(a.weighted) || a.id - b.id);
    const rivals = byXp.filter((player) => rival.has(player.id));

    const chosen: number[] = [];
    const seen = new Set<number>();
    const take = (source: PoolPlayer[], count: number) => {
      let taken = 0;
      for (const player of source) {
        if (taken >= count || chosen.length >= TRANSFER_PARAMS.poolPerPosition) break;
        if (seen.has(player.id)) continue;
        seen.add(player.id);
        chosen.push(player.id);
        taken += 1;
      }
    };
    take(byXp, TRANSFER_PARAMS.poolXpTop);
    take(byForm, TRANSFER_PARAMS.poolFormTop);
    take(rising, TRANSFER_PARAMS.poolRisingTop);
    take(rivals, TRANSFER_PARAMS.poolRivalTop);
    take(byXp, TRANSFER_PARAMS.poolPerPosition);
    pool.set(type, chosen);
  }
  return pool;
}

/** The searched candidates per position (element_type -> player IDs), for tests and for the later AI input block. */
export function buildCandidatePool(table: XpTable, horizon: number, ownIds: Iterable<number>, rivalOwnedIds: Iterable<number> = []) {
  const weights = new Float64Array(Math.min(horizon, table.gws.length));
  for (let g = 0; g < weights.length; g += 1) {
    weights[g] = XP_PARAMS.discount[g] ?? XP_PARAMS.discount[XP_PARAMS.discount.length - 1];
  }
  return buildPool(table, weights, new Set(ownIds), new Set(rivalOwnedIds));
}

// ---------------------------------------------------------------------------------------------------------------
// Ranked lists of scenarios

type Entry = { out: number[]; in: number[]; net: number; value: number };

function compareIdLists(a: number[], b: number[]) {
  for (let i = 0; i < Math.min(a.length, b.length); i += 1) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return a.length - b.length;
}

function compareEntries(a: Entry, b: Entry) {
  return scaled(b.net) - scaled(a.net) || compareIdLists(a.out, b.out) || compareIdLists(a.in, b.in);
}

class TopList {
  readonly items: Entry[] = [];
  constructor(private readonly limit: number) {}

  /** Net a newcomer must beat to get in; -Infinity while the list has room. */
  get threshold() {
    return this.items.length < this.limit ? -Infinity : this.items[this.items.length - 1].net;
  }

  offer(entry: Entry) {
    if (this.items.length >= this.limit && compareEntries(entry, this.items[this.items.length - 1]) >= 0) {
      return;
    }
    let index = this.items.length;
    while (index > 0 && compareEntries(entry, this.items[index - 1]) < 0) index -= 1;
    this.items.splice(index, 0, entry);
    if (this.items.length > this.limit) this.items.pop();
  }
}

// ---------------------------------------------------------------------------------------------------------------
// The search

export async function searchTransfers(
  input: TransferSearchInput,
  options: TransferSearchOptions = {}
): Promise<{ result: TransferSearchResult; stats: TransferSearchStats }> {
  const now = options.now ?? (() => performance.now());
  const slicer = new Slicer(options.sliceMs ?? TRANSFER_PARAMS.sliceMs, now, options.yieldToLoop ?? defaultWait);
  const startedAt = now();
  let evaluations = 0;
  let twoEvaluations = 0;

  // Slot order = player ID order, so the sums (and every printed figure) do not depend on how the caller ordered the squad.
  const { table } = input;
  const squadInput = [...input.squad].sort((a, b) => a.id - b.id);
  const horizon = Math.min(input.horizon, table.gws.length);
  const gws = table.gws.slice(0, horizon);
  const weights = new Float64Array(horizon);
  for (let g = 0; g < horizon; g += 1) {
    weights[g] = XP_PARAMS.discount[g] ?? XP_PARAMS.discount[XP_PARAMS.discount.length - 1];
  }
  const firstWeekOnly = new Float64Array(horizon);
  if (horizon > 0) firstWeekOnly[0] = weights[0];

  // --- money
  const sellingPriceFallback = squadInput.some((player) => player.sellingPrice === null);
  const freeTransfersFallback = input.freeTransfers === null;
  const free = input.freeTransfers ?? 1;
  const sell = squadInput.map((player) => Math.round(player.sellingPrice ?? player.nowCost));
  const bank = Math.round(input.bank);
  const budget = sell.reduce((sum, price) => sum + price, 0) + bank;

  // --- candidates: the own 15 first (index = slot), then the pool
  const toXp = (id: number) => {
    const row = table.players.get(id);
    const xp = new Float64Array(horizon);
    for (let g = 0; g < horizon; g += 1) xp[g] = row?.weeks[g]?.xp ?? 0;
    return xp;
  };
  const cands: Cand[] = squadInput.map((player, slot) => ({
    id: player.id,
    type: player.elementType,
    team: player.teamId,
    cost: sell[slot],
    own: true,
    xp: toXp(player.id)
  }));
  const ownIds = new Set(squadInput.map((player) => player.id));
  const pool = buildPool(table, weights, ownIds, new Set(input.rivalOwnedIds ?? []));
  const byType = new Map<number, number[]>();
  let poolSize = 0;
  for (const [type, ids] of pool) {
    const indices: number[] = [];
    for (const id of ids) {
      const row = table.players.get(id)!;
      indices.push(cands.length);
      cands.push({ id, type, team: row.teamId, cost: row.nowCost, own: false, xp: toXp(id) });
    }
    byType.set(type, indices);
    poolSize += ids.length;
  }

  const slots = squadInput.length;
  const baseSquad = Int32Array.from({ length: slots }, (_, slot) => slot);
  const maxTeam = cands.reduce((max, cand) => Math.max(max, cand.team), 0);
  const teamCount = new Int32Array(maxTeam + 1);
  for (const cand of cands.slice(0, slots)) teamCount[cand.team] += 1;

  const baseValue = score(cands, baseSquad, weights);
  const baseFirstValue = score(cands, baseSquad, firstWeekOnly);

  const periodXi = (squad: ArrayLike<number>, w: Float64Array) => {
    score(cands, squad, w);
    return lastXi;
  };
  const nextXi = (squad: ArrayLike<number>) => periodXi(squad, firstWeekOnly) / (weights[0] || 1);

  const idsOf = (squad: ArrayLike<number>) => Array.from(squad, (index) => cands[index].id);
  const diffIds = (squad: ArrayLike<number>) => {
    const now = new Set(idsOf(squad));
    return {
      out: squadInput.map((player) => player.id).filter((id) => !now.has(id)).sort((a, b) => a - b),
      in: idsOf(squad).filter((id) => !ownIds.has(id)).sort((a, b) => a - b)
    };
  };
  const spent = (squad: ArrayLike<number>) => Array.from(squad).reduce((sum, index) => sum + cands[index].cost, 0);

  const scenarioFrom = (
    type: ScenarioType,
    id: string,
    squad: ArrayLike<number>,
    cost: number,
    netGain: number,
    optimal: boolean,
    futureBase?: { xi: number }
  ): TransferScenario => {
    const { out, in: incoming } = diffIds(squad);
    const bankAfter = budget - spent(squad);
    const involved = new Set(out);
    return {
      id,
      type,
      out,
      in: incoming,
      nextGwXp: nextXi(squad),
      periodXp: futureBase ? futureBase.xi : periodXi(squad, weights),
      transferCost: cost,
      netGain,
      bankAfter,
      budgetTight: type !== "roll" && bankAfter <= TRANSFER_PARAMS.tightBank,
      sellingPriceEstimated:
        type === "roll"
          ? false
          : type === "wildcard" || type === "freehit"
            ? sellingPriceFallback
            : squadInput.some((player) => player.sellingPrice === null && involved.has(player.id)),
      freeTransfersEstimated: freeTransfersFallback && (type === "one" || type === "two"),
      optimal
    };
  };

  const scenarios: TransferScenario[] = [];

  // --- roll
  scenarios.push({
    id: "roll",
    type: "roll",
    out: [],
    in: [],
    nextGwXp: nextXi(baseSquad),
    periodXp: periodXi(baseSquad, weights),
    transferCost: 0,
    netGain: 0,
    bankAfter: bank,
    budgetTight: false,
    sellingPriceEstimated: false,
    freeTransfersEstimated: false,
    optimal: true
  });

  // --- gain bound per (own slot, candidate): the most one swap can add to the value
  const bound: Float64Array[] = [];
  for (let slot = 0; slot < slots; slot += 1) {
    const row = new Float64Array(cands.length);
    const own = cands[slot];
    for (const index of byType.get(own.type) ?? []) {
      let sum = 0;
      for (let g = 0; g < horizon; g += 1) {
        const delta = cands[index].xp[g] - own.xp[g];
        if (delta > 0) sum += weights[g] * delta;
      }
      row[index] = sum;
    }
    bound.push(row);
  }

  // --- 1 transfer (exact inside the pool)
  const one = new TopList(TRANSFER_PARAMS.topN);
  const cost1 = transferCost(1, free);
  const working = Int32Array.from(baseSquad);
  for (let slot = 0; slot < slots; slot += 1) {
    const own = cands[slot];
    teamCount[own.team] -= 1;
    for (const index of byType.get(own.type) ?? []) {
      const cand = cands[index];
      if (cand.cost > sell[slot] + bank || teamCount[cand.team] >= 3) continue;
      working[slot] = index;
      const value = score(cands, working, weights);
      evaluations += 1;
      one.offer({ out: [own.id], in: [cand.id], value, net: value - baseValue - cost1 });
      if (slicer.due()) await slicer.yield();
    }
    working[slot] = slot;
    teamCount[own.team] += 1;
  }
  for (const entry of one.items) {
    const squad = Int32Array.from(baseSquad);
    const slot = squadInput.findIndex((player) => player.id === entry.out[0]);
    squad[slot] = cands.findIndex((cand) => !cand.own && cand.id === entry.in[0]);
    scenarios.push(scenarioFrom("one", `one:${entry.out[0]}>${entry.in[0]}`, squad, cost1, entry.net, true));
  }

  // --- 2 transfers (exact inside the pool; pairs are pruned by an upper bound)
  const two = new TopList(TRANSFER_PARAMS.topN);
  const cost2 = transferCost(2, free);
  for (let a = 0; a < slots; a += 1) {
    for (let b = a + 1; b < slots; b += 1) {
      const ownA = cands[a];
      const ownB = cands[b];
      const money = sell[a] + sell[b] + bank;
      teamCount[ownA.team] -= 1;
      teamCount[ownB.team] -= 1;
      const listA = byType.get(ownA.type) ?? [];
      const listB = byType.get(ownB.type) ?? [];
      const sameType = ownA.type === ownB.type;

      for (let i = 0; i < listA.length; i += 1) {
        const x = listA[i];
        const candX = cands[x];
        if (teamCount[candX.team] >= 3) continue;
        for (let j = sameType ? i + 1 : 0; j < listB.length; j += 1) {
          const y = listB[j];
          const candY = cands[y];
          if (candX.cost + candY.cost > money) continue;
          if (candY.team === candX.team ? teamCount[candY.team] + 2 > 3 : teamCount[candY.team] >= 3) continue;

          // Upper bound of the gain (the two ways of pairing out with in give the same squad: take the tighter).
          let limit = bound[a][x] + bound[b][y];
          if (sameType) limit = Math.min(limit, bound[a][y] + bound[b][x]);
          if (!options.exhaustive && scaled(limit - cost2) < scaled(two.threshold) - 1) continue;

          working[a] = x;
          working[b] = y;
          const value = score(cands, working, weights);
          evaluations += 1;
          twoEvaluations += 1;
          if (scaled(value - baseValue - cost2) >= scaled(two.threshold) - 1) {
            const outs = [ownA.id, ownB.id].sort((p, q) => p - q);
            const ins = [candX.id, candY.id].sort((p, q) => p - q);
            two.offer({ out: outs, in: ins, value, net: value - baseValue - cost2 });
          }
          if (slicer.due()) await slicer.yield();
        }
      }
      working[a] = a;
      working[b] = b;
      teamCount[ownA.team] += 1;
      teamCount[ownB.team] += 1;
      if (slicer.due()) await slicer.yield();
    }
  }
  for (const entry of two.items) {
    const squad = Int32Array.from(baseSquad);
    // Incoming players take the leaving slots in order; only the squad as a set matters.
    entry.out.forEach((id, k) => {
      squad[squadInput.findIndex((player) => player.id === id)] = cands.findIndex((cand) => !cand.own && cand.id === entry.in[k]);
    });
    scenarios.push(scenarioFrom("two", `two:${entry.out.join("+")}>${entry.in.join("+")}`, squad, cost2, entry.net, true));
  }

  // --- Wildcard / Free Hit: greedy + swap improvement over the pool plus the own squad
  const allByType = new Map<number, number[]>();
  for (let index = 0; index < cands.length; index += 1) {
    const list = allByType.get(cands[index].type) ?? [];
    list.push(index);
    allByType.set(cands[index].type, list);
  }

  const optimise = async (w: Float64Array) => {
    const tcount = new Int32Array(maxTeam + 1);
    const inSquad = new Uint8Array(cands.length);

    const climb = async (start: number[]) => {
      const squad = [...start];
      tcount.fill(0);
      inSquad.fill(0);
      let cost = 0;
      for (const index of squad) {
        tcount[cands[index].team] += 1;
        inSquad[index] = 1;
        cost += cands[index].cost;
      }
      let value = score(cands, squad, w);
      for (;;) {
        let bestGain = EPS;
        let bestSlot = -1;
        let bestCand = -1;
        for (let slot = 0; slot < squad.length; slot += 1) {
          const current = cands[squad[slot]];
          tcount[current.team] -= 1;
          for (const index of allByType.get(current.type) ?? []) {
            const cand = cands[index];
            if (inSquad[index] || tcount[cand.team] >= 3 || cost - current.cost + cand.cost > budget) continue;
            const keep = squad[slot];
            squad[slot] = index;
            const candidate = score(cands, squad, w);
            squad[slot] = keep;
            evaluations += 1;
            if (candidate - value > bestGain) {
              bestGain = candidate - value;
              bestSlot = slot;
              bestCand = index;
            }
            if (slicer.due()) await slicer.yield();
          }
          tcount[current.team] += 1;
        }
        if (bestSlot < 0) break;
        const leaving = cands[squad[bestSlot]];
        tcount[leaving.team] -= 1;
        inSquad[squad[bestSlot]] = 0;
        cost += cands[bestCand].cost - leaving.cost;
        squad[bestSlot] = bestCand;
        tcount[cands[bestCand].team] += 1;
        inSquad[bestCand] = 1;
        value += bestGain;
      }
      return { squad, value: score(cands, squad, w) };
    };

    const quota = [0, 2, 5, 5, 3];
    const fill = (order: (a: number, b: number) => number) => {
      const tc = new Int32Array(maxTeam + 1);
      const squad: number[] = [];
      for (const type of [1, 2, 3, 4]) {
        const sorted = [...(allByType.get(type) ?? [])].sort(order);
        let taken = 0;
        for (const index of sorted) {
          if (taken >= quota[type]) break;
          if (tc[cands[index].team] >= 3) continue;
          tc[cands[index].team] += 1;
          squad.push(index);
          taken += 1;
        }
      }
      return squad.length === 15 ? squad : null;
    };

    const starts: number[][] = [[...baseSquad]];
    const cheapest = fill((p, q) => cands[p].cost - cands[q].cost || cands[p].id - cands[q].id);
    if (cheapest && spent(cheapest) <= budget) starts.push(cheapest);

    // The best-by-xP squad, repaired down to the budget by giving up the least xP per tenth saved.
    const top = fill((p, q) => {
      let sumP = 0;
      let sumQ = 0;
      for (let g = 0; g < horizon; g += 1) {
        sumP += w[g] * cands[p].xp[g];
        sumQ += w[g] * cands[q].xp[g];
      }
      return scaled(sumQ) - scaled(sumP) || cands[p].id - cands[q].id;
    });
    if (top) {
      let cost = spent(top);
      let guard = 0;
      while (cost > budget && guard < 60) {
        guard += 1;
        const tc = new Int32Array(maxTeam + 1);
        for (const index of top) tc[cands[index].team] += 1;
        const here = new Set(top);
        const baseV = score(cands, top, w);
        let pick: { slot: number; index: number; ratio: number } | null = null;
        for (let slot = 0; slot < top.length; slot += 1) {
          const current = cands[top[slot]];
          tc[current.team] -= 1;
          for (const index of allByType.get(current.type) ?? []) {
            const cand = cands[index];
            if (here.has(index) || cand.cost >= current.cost || tc[cand.team] >= 3) continue;
            const keep = top[slot];
            top[slot] = index;
            const loss = baseV - score(cands, top, w);
            top[slot] = keep;
            evaluations += 1;
            const ratio = loss / (current.cost - cand.cost);
            if (!pick || ratio < pick.ratio - EPS) pick = { slot, index, ratio };
            if (slicer.due()) await slicer.yield();
          }
          tc[current.team] += 1;
        }
        if (!pick) break;
        cost += cands[pick.index].cost - cands[top[pick.slot]].cost;
        top[pick.slot] = pick.index;
      }
      if (cost <= budget) starts.push(top);
    }

    let best: { squad: number[]; value: number } | null = null;
    for (const start of starts) {
      const outcome = await climb(start);
      if (!best || outcome.value > best.value + EPS) best = outcome;
    }
    return best!.squad;
  };

  const skipped: TransferSearchResult["skipped"] = [];

  if (input.chips.wildcard.available) {
    const squad = await optimise(weights);
    const value = score(cands, squad, weights);
    scenarios.push(
      scenarioFrom("wildcard", "wildcard", squad, 0, value - baseValue, false)
    );
  } else {
    skipped.push({ type: "wildcard", reason: input.chips.wildcard.reason });
  }

  if (input.chips.freehit.available) {
    const squad = await optimise(firstWeekOnly);
    const value = score(cands, squad, firstWeekOnly);
    // After the Free Hit week the squad goes back: only the first week changes.
    const keptLater = periodXi(baseSquad, weights) - periodXi(baseSquad, firstWeekOnly);
    scenarios.push(
      scenarioFrom("freehit", "freehit", squad, 0, value - baseFirstValue, false, {
        xi: periodXi(squad, firstWeekOnly) + keptLater
      })
    );
  } else {
    skipped.push({ type: "freehit", reason: input.chips.freehit.reason });
  }

  // --- recommendation: biggest net gain (chips pay their opportunity cost here), else roll
  let recommended = scenarios[0];
  let recommendedAdjusted = 0;
  for (const scenario of scenarios) {
    const adjusted = scenario.netGain - (scenario.type === "wildcard" || scenario.type === "freehit" ? TRANSFER_PARAMS.chipOpportunityCost : 0);
    if (scaled(adjusted) > scaled(recommendedAdjusted)) {
      recommended = scenario;
      recommendedAdjusted = adjusted;
    }
  }
  if (recommendedAdjusted < TRANSFER_PARAMS.minNetGain) {
    recommended = scenarios[0];
  }

  slicer.finish();
  return {
    result: {
      horizon: input.horizon,
      gws,
      poolSize,
      scenarios,
      recommendedId: recommended.id,
      skipped,
      bank,
      budget,
      freeTransfers: free,
      estimates: {
        sellingPriceFallback,
        freeTransfersFallback,
        freeTransfersUnreliable: input.freeTransfersUnreliable ?? false
      },
      params: {
        benchWeight: TRANSFER_PARAMS.benchWeight,
        minNetGain: TRANSFER_PARAMS.minNetGain,
        chipOpportunityCost: TRANSFER_PARAMS.chipOpportunityCost
      }
    },
    stats: {
      evaluations,
      slices: slicer.slices + 1,
      maxSliceMs: slicer.maxSliceMs,
      elapsedMs: now() - startedAt,
      twoTransferEvaluations: twoEvaluations
    }
  };
}
