import type { XpGameweekXp, XpPlayer, XpTable } from "@/lib/xp/model";
import type { TransferSearchInput, TransferSquadPlayer } from "@/lib/xp/transfer-search";

/** Synthetic xP tables and squads for the transfer-search tests (issue #43 stage 1-B). Types: 1 GK, 2 DEF, 3 MID, 4 FWD. */
export type Spec = {
  id: number;
  type: number;
  team: number;
  /** Tenths. */
  cost: number;
  /** xP per gameweek; a single number is the same every week. */
  xp: number | number[];
  form?: number;
  availability?: number;
  status?: string;
  likelihood?: number;
};

export const GWS = [12, 13, 14, 15, 16, 17];

export function mkTable(specs: Spec[], gws: number[] = GWS, builtAt = 1_000): XpTable {
  const players = new Map<number, XpPlayer>();
  for (const spec of specs) {
    const per = Array.isArray(spec.xp) ? spec.xp : gws.map(() => spec.xp as number);
    const weeks: XpGameweekXp[] = gws.map((gw, index) => ({ gw, xp: per[index] ?? 0, games: [] }));
    players.set(spec.id, {
      id: spec.id,
      teamId: spec.team,
      elementType: spec.type,
      status: spec.status ?? "a",
      selectedByPercent: 5,
      nowCost: spec.cost,
      form: spec.form ?? per[0] ?? 0,
      priceLikelihood: spec.likelihood ?? 0,
      base: per[0] ?? 0,
      startRatio: 1,
      playChance: 1,
      availability: spec.availability ?? 1,
      weeks,
      next: per[0] ?? 0,
      sum3: 0,
      sum5: 0
    });
  }
  return { modelVersion: "xp1", targetGw: gws[0], targetDeadline: null, gws, builtAt, players };
}

/** 2 GK, 5 DEF, 5 MID, 3 FWD with IDs GK 1-2, DEF 11-15, MID 21-25, FWD 31-33, each from its own club (club = id), 5.0m each, xP `xp`. */
export function baseSquadSpecs(xp: Record<number, number | number[]> = {}, defaultXp = 2): Spec[] {
  const rows: Array<[number, number]> = [
    [1, 1], [2, 1], [11, 2], [12, 2], [13, 2], [14, 2], [15, 2], [21, 3], [22, 3], [23, 3], [24, 3], [25, 3], [31, 4], [32, 4], [33, 4]
  ];
  return rows.map(([id, type]) => ({ id, type, team: id, cost: 50, xp: xp[id] ?? defaultXp }));
}

export function squadOf(specs: Spec[], ids: number[], sellingPrice: (id: number) => number | null = () => 50): TransferSquadPlayer[] {
  return ids.map((id) => {
    const spec = specs.find((item) => item.id === id)!;
    return { id, elementType: spec.type, teamId: spec.team, sellingPrice: sellingPrice(id), nowCost: spec.cost };
  });
}

export const OWN_IDS = [1, 2, 11, 12, 13, 14, 15, 21, 22, 23, 24, 25, 31, 32, 33];

export function mkInput(specs: Spec[], extra: Partial<TransferSearchInput> = {}): TransferSearchInput {
  return {
    squad: squadOf(specs, OWN_IDS),
    bank: 0,
    freeTransfers: 1,
    table: mkTable(specs),
    horizon: 3,
    chips: { wildcard: { available: false, reason: "chip_used" }, freehit: { available: false, reason: "chip_used" } },
    ...extra
  };
}

/** Small deterministic PRNG (mulberry32) so the random tables are the same every run. */
export function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A league-sized world: `perType` non-owned candidates per position plus the own 15, 20 clubs, prices 4.0m to
 * 13.0m, xP a mix of low and high per gameweek. Own players get IDs 1..., candidates 100+.
 */
export function randomWorld(seed: number, perType = [24, 90, 100, 60], horizonGws = 6) {
  const rnd = prng(seed);
  const specs: Spec[] = [];
  const weekly = (level: number) => Array.from({ length: horizonGws }, () => Math.max(0, level * (0.5 + rnd())));
  // own squad
  const ownRows: Array<[number, number]> = [
    [1, 1], [2, 1], [11, 2], [12, 2], [13, 2], [14, 2], [15, 2], [21, 3], [22, 3], [23, 3], [24, 3], [25, 3], [31, 4], [32, 4], [33, 4]
  ];
  for (const [id, type] of ownRows) {
    const price = 40 + Math.floor(rnd() * 70);
    specs.push({ id, type, team: 1 + Math.floor(rnd() * 20), cost: price, xp: weekly(type === 1 ? 3 : 2 + rnd() * 3), form: rnd() * 8 });
  }
  let next = 100;
  [1, 2, 3, 4].forEach((type, index) => {
    for (let k = 0; k < perType[index]; k += 1) {
      const price = 40 + Math.floor(rnd() * 90);
      const level = type === 1 ? 2 + rnd() * 3 : 1 + rnd() * 6;
      specs.push({
        id: next,
        type,
        team: 1 + Math.floor(rnd() * 20),
        cost: price,
        xp: weekly(level),
        form: rnd() * 9,
        likelihood: rnd() < 0.05 ? 5 : 0,
        availability: rnd() < 0.1 ? 0 : 1
      });
      next += 1;
    }
  });
  const squad = ownRows.map(([id]) => {
    const spec = specs.find((item) => item.id === id)!;
    // Selling price a little under or equal to the current price.
    return { id, elementType: spec.type, teamId: spec.team, sellingPrice: spec.cost - Math.floor(rnd() * 3), nowCost: spec.cost };
  });
  // Club limit for the own squad: at most 3 of the 15 from one club (rewrite clubs if the draw broke it).
  const seen = new Map<number, number>();
  for (const player of squad) {
    let team = player.teamId;
    while ((seen.get(team) ?? 0) >= 3) team = (team % 20) + 1;
    seen.set(team, (seen.get(team) ?? 0) + 1);
    player.teamId = team;
    specs.find((item) => item.id === player.id)!.team = team;
  }
  return { specs, squad, table: mkTable(specs, GWS.slice(0, horizonGws)) };
}
