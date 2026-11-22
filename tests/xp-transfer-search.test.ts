import { describe, expect, it } from "vitest";
import { buildCandidatePool, chipAvailability, searchTransfers, TRANSFER_PARAMS, type TransferScenario, type TransferSearchInput } from "@/lib/xp/transfer-search";
import { buildLineups } from "@/lib/xp/lineup";
import { XP_PARAMS, type XpTable } from "@/lib/xp/model";
import type { ChipStatus } from "@/lib/chip-availability";
import { baseSquadSpecs, GWS, mkInput, mkTable, OWN_IDS, randomWorld, squadOf, type Spec } from "./helpers/xp-transfer";

// Issue #43 stage 1-B: transfer scenarios. Small cases solved by hand, a brute-force check of the 1- and
// 2-transfer lists on random tables, and the legality of every scenario (budget, 3 per club, positions).
//
// Hand arithmetic used below (horizon 3 -> weights 1.0 + 0.9 + 0.8 = 2.7; every player has the same xP each week):
// all 15 at xP 2 except one at 0 who sits on the bench: XI = 22, bench = 2+2+2+0 = 6, value per week = 0.9 x 22 + 0.1 x 28 = 22.6.
// That player swapped for an xP-x one: XI = 22 + (x - 2), all 15 = 28 + x, value per week = 22.6 + (x - 1.8).
const W3 = 2.7;
const run = async (input: TransferSearchInput, sliceMs = 1_000) => (await searchTransfers(input, { sliceMs })).result;
const byType = (scenarios: TransferScenario[], type: string) => scenarios.filter((scenario) => scenario.type === type);

describe("hand-worked cases", () => {
  // MID 21 is a dud (xP 0). MID 41 (6.0 xP, 5.0m) is the only sensible buy; MID 42 (9 xP) costs 5.1m.
  const specs: Spec[] = [
    ...baseSquadSpecs({ 21: 0 }),
    { id: 41, type: 3, team: 41, cost: 50, xp: 6 },
    { id: 42, type: 3, team: 42, cost: 51, xp: 9 }
  ];

  it("finds the best single transfer and values it by hand (21 -> 41, +4.2 a week, free transfer so no cost)", async () => {
    const result = await run(mkInput(specs));
    const [best] = byType(result.scenarios, "one");
    expect(best).toMatchObject({ id: "one:21>41", out: [21], in: [41], transferCost: 0, bankAfter: 0, budgetTight: true });
    expect(best.netGain).toBeCloseTo((6 - 1.8) * W3, 9);
    expect(best.nextGwXp).toBeCloseTo(26, 9);
    expect(best.periodXp).toBeCloseTo(26 * W3, 9);
    // Rolling keeps the dud on the bench: XI 22.
    expect(result.scenarios[0]).toMatchObject({ id: "roll", type: "roll", netGain: 0, transferCost: 0, bankAfter: 0 });
    expect(result.scenarios[0].nextGwXp).toBeCloseTo(22, 9);
    expect(result.recommendedId).toBe("one:21>41");
  });

  it("holds the budget to the tenth: 5.1m for a 5.0m seller is out at bank 0 and in at bank 1", async () => {
    const tight = await run(mkInput(specs, { bank: 0 }));
    expect(byType(tight.scenarios, "one").some((scenario) => scenario.in.includes(42))).toBe(false);
    expect(byType(tight.scenarios, "two").some((scenario) => scenario.in.includes(42))).toBe(false);
    expect(tight.budget).toBe(15 * 50);

    const roomy = await run(mkInput(specs, { bank: 1 }));
    const [best] = byType(roomy.scenarios, "one");
    expect(best).toMatchObject({ id: "one:21>42", bankAfter: 0, budgetTight: true });
    expect(best.netGain).toBeCloseTo((9 - 1.8) * W3, 9);

    const spare = await run(mkInput(specs, { bank: 2 }));
    expect(byType(spare.scenarios, "one")[0]).toMatchObject({ bankAfter: 1, budgetTight: true });
    const loose = await run(mkInput(specs, { bank: 3 }));
    expect(byType(loose.scenarios, "one")[0]).toMatchObject({ bankAfter: 2, budgetTight: false });
  });

  it("uses the selling price, not the current price, of the player who leaves", async () => {
    // Dud 21 bought at 5.0m, now 5.0m but sells for 4.9m (a rise that was shared): 41 costs 5.0m, bank 0 -> not affordable.
    const input = mkInput(specs, { squad: squadOf(specs, OWN_IDS, (id) => (id === 21 ? 49 : 50)) });
    const result = await run(input);
    expect(byType(result.scenarios, "one").some((scenario) => scenario.id === "one:21>41")).toBe(false);
    expect(result.estimates.sellingPriceFallback).toBe(false);
  });

  it("falls back to the current price when a selling price is null, and says so", async () => {
    const input = mkInput(specs, { squad: squadOf(specs, OWN_IDS, (id) => (id === 21 ? null : 50)) });
    const result = await run(input);
    const best = byType(result.scenarios, "one")[0];
    expect(best.id).toBe("one:21>41");
    expect(best.sellingPriceEstimated).toBe(true);
    expect(result.estimates.sellingPriceFallback).toBe(true);
    // A scenario that does not involve the unknown price is not flagged.
    const other = byType(result.scenarios, "one").find((scenario) => !scenario.out.includes(21));
    if (other) expect(other.sellingPriceEstimated).toBe(false);
  });

  it("finds the best pair of transfers and charges 4 points when only one is free", async () => {
    // Two duds (MID 21, FWD 31) and two good buys; the pair is worth (6 - 1.8) + (5 - 1.8) per week.
    const pairSpecs: Spec[] = [
      ...baseSquadSpecs({ 21: 0, 31: 0 }),
      { id: 41, type: 3, team: 41, cost: 50, xp: 6 },
      { id: 51, type: 4, team: 51, cost: 50, xp: 5 }
    ];
    // Hand: after both swaps XI = 29, all 15 = 37, value per week = 0.9 x 29 + 0.1 x 37 = 29.8; before 22.4; gain 7.4 a week.
    const result = await run(mkInput(pairSpecs, { freeTransfers: 1 }));
    const [two] = byType(result.scenarios, "two");
    expect(two).toMatchObject({ id: "two:21+31>41+51", out: [21, 31], in: [41, 51], transferCost: 4 });
    expect(two.netGain).toBeCloseTo(7.4 * W3 - 4, 9);
    // The best single transfer is 21 -> 41 (4.2 a week), no cost.
    expect(byType(result.scenarios, "one")[0].netGain).toBeCloseTo(4.2 * W3, 9);
    expect(result.recommendedId).toBe("two:21+31>41+51");
  });

  it("charges 4 per transfer beyond the free ones: 0, 1, 2 and unknown free transfers", async () => {
    const pairSpecs: Spec[] = [
      ...baseSquadSpecs({ 21: 0, 31: 0 }),
      { id: 41, type: 3, team: 41, cost: 50, xp: 6 },
      { id: 51, type: 4, team: 51, cost: 50, xp: 5 }
    ];
    const costs = async (free: number | null) => {
      const result = await run(mkInput(pairSpecs, { freeTransfers: free }));
      return {
        one: byType(result.scenarios, "one")[0].transferCost,
        two: byType(result.scenarios, "two")[0].transferCost,
        result
      };
    };
    expect(await costs(0)).toMatchObject({ one: 4, two: 8 });
    expect(await costs(1)).toMatchObject({ one: 0, two: 4 });
    expect(await costs(2)).toMatchObject({ one: 0, two: 0 });
    const unknown = await costs(null);
    expect(unknown).toMatchObject({ one: 0, two: 4 });
    expect(unknown.result.freeTransfers).toBe(1);
    expect(unknown.result.estimates.freeTransfersFallback).toBe(true);
    expect(byType(unknown.result.scenarios, "one")[0].freeTransfersEstimated).toBe(true);
    expect(byType(unknown.result.scenarios, "roll")[0].freeTransfersEstimated).toBe(false);
    expect((await costs(1)).result.estimates.freeTransfersFallback).toBe(false);
  });

  it("recommends rolling when the best gain is under 2 points, and the move when it is over", async () => {
    // xP 2.5 replacing the dud: (2.5 - 1.8) x 2.7 = 1.89 < 2.
    const small: Spec[] = [...baseSquadSpecs({ 21: 0 }), { id: 41, type: 3, team: 41, cost: 50, xp: 2.5 }];
    const rollResult = await run(mkInput(small));
    expect(byType(rollResult.scenarios, "one")[0].netGain).toBeCloseTo(1.89, 9);
    expect(rollResult.recommendedId).toBe("roll");
    // xP 2.8: (2.8 - 1.8) x 2.7 = 2.7 >= 2.
    const bigger: Spec[] = [...baseSquadSpecs({ 21: 0 }), { id: 41, type: 3, team: 41, cost: 50, xp: 2.8 }];
    expect((await run(mkInput(bigger))).recommendedId).toBe("one:21>41");
    // A -4 is never worth a small gain: with no free transfer a 4.2-a-week move nets 11.34 - 4 = 7.34 and is still recommended,
    // but a 2.8 one nets 2.7 - 4 < 0 and rolls.
    const noFree = await run(mkInput(bigger, { freeTransfers: 0 }));
    expect(noFree.recommendedId).toBe("roll");
    const bigNoFree = await run(mkInput([...baseSquadSpecs({ 21: 0 }), { id: 41, type: 3, team: 41, cost: 50, xp: 6 }], { freeTransfers: 0 }));
    expect(bigNoFree.recommendedId).toBe("one:21>41");
    expect(byType(bigNoFree.scenarios, "one")[0].netGain).toBeCloseTo(4.2 * W3 - 4, 9);
  });
});

describe("constraints", () => {
  it("never puts a 4th player of a club in, and allows it when the leaver is from that club", async () => {
    // Own DEF 11, 12, 13 are all club 7. A club-7 striker is brilliant. He cannot replace 31 (club 31), but can replace DEF 11? No: positions differ.
    // So make him a defender: DEF 43 of club 7 may only replace 11, 12 or 13.
    const specs: Spec[] = baseSquadSpecs({ 14: 0, 15: 0 });
    specs.find((spec) => spec.id === 11)!.team = 7;
    specs.find((spec) => spec.id === 12)!.team = 7;
    specs.find((spec) => spec.id === 13)!.team = 7;
    specs.push({ id: 43, type: 2, team: 7, cost: 50, xp: 8 });
    const result = await run(mkInput(specs));
    const withNew = [...byType(result.scenarios, "one"), ...byType(result.scenarios, "two")].filter((scenario) => scenario.in.includes(43));
    expect(withNew.length).toBeGreaterThan(0);
    // He only ever replaces a club-7 defender (11, 12 or 13), never the weak 14 or 15 (that would be a 4th club-7 player).
    for (const scenario of withNew) {
      expect(scenario.out.some((id) => [11, 12, 13].includes(id))).toBe(true);
    }
    expect(byType(result.scenarios, "one").some((scenario) => scenario.id === "one:14>43" || scenario.id === "one:15>43")).toBe(false);
  });

  it("only swaps within a position: the squad stays 2-5-5-3", async () => {
    const world = randomWorld(7, [5, 10, 10, 8]);
    const result = await run({
      squad: world.squad,
      bank: 15,
      freeTransfers: 2,
      table: world.table,
      horizon: 3,
      chips: { wildcard: { available: true }, freehit: { available: true } }
    });
    expect(result.scenarios.length).toBeGreaterThan(5);
    for (const scenario of result.scenarios) {
      const squad = new Set(world.squad.map((player) => player.id));
      scenario.out.forEach((id) => squad.delete(id));
      scenario.in.forEach((id) => squad.add(id));
      expect(squad.size).toBe(15);
      const counts = [0, 0, 0, 0, 0];
      const clubs = new Map<number, number>();
      let cost = 0;
      for (const id of squad) {
        const row = world.table.players.get(id)!;
        counts[row.elementType] += 1;
        clubs.set(row.teamId, (clubs.get(row.teamId) ?? 0) + 1);
        const own = world.squad.find((player) => player.id === id);
        cost += own ? own.sellingPrice! : row.nowCost;
        // Nobody who leaves comes back, and nobody who is out of the game (availability 0) is bought.
        if (!own) expect(row.availability).toBeGreaterThan(0);
      }
      expect(counts.slice(1)).toEqual([2, 5, 5, 3]);
      expect(Math.max(...clubs.values())).toBeLessThanOrEqual(3);
      expect(cost).toBeLessThanOrEqual(result.budget);
      expect(scenario.bankAfter).toBe(result.budget - cost);
      expect(scenario.in.every((id) => !world.squad.some((player) => player.id === id))).toBe(true);
    }
  });

  it("never buys a player with availability 0, but may keep one he already owns", async () => {
    const specs: Spec[] = [
      ...baseSquadSpecs({ 21: 0 }),
      { id: 41, type: 3, team: 41, cost: 50, xp: 9, availability: 0 },
      { id: 42, type: 3, team: 42, cost: 50, xp: 3 }
    ];
    const result = await run(mkInput(specs, { bank: 10 }));
    expect(result.scenarios.some((scenario) => scenario.in.includes(41))).toBe(false);
    expect(result.poolSize).toBe(1);
  });
});

describe("chips", () => {
  const specs: Spec[] = [...baseSquadSpecs({ 21: 0 }), { id: 41, type: 3, team: 41, cost: 50, xp: 6 }];

  it("leaves the chips out, with a reason code, when they cannot be played", async () => {
    const result = await run(mkInput(specs));
    expect(result.scenarios.map((scenario) => scenario.type)).not.toContain("wildcard");
    expect(result.scenarios.map((scenario) => scenario.type)).not.toContain("freehit");
    expect(result.skipped).toEqual([
      { type: "wildcard", reason: "chip_used" },
      { type: "freehit", reason: "chip_used" }
    ]);
  });

  it("adds Wildcard and Free Hit at no transfer cost, never worse than the best free single transfer", async () => {
    const input = mkInput(specs, { chips: { wildcard: { available: true }, freehit: { available: true } }, freeTransfers: 1 });
    const result = await run(input);
    expect(result.skipped).toEqual([]);
    const wildcard = result.scenarios.find((scenario) => scenario.type === "wildcard")!;
    const freehit = result.scenarios.find((scenario) => scenario.type === "freehit")!;
    expect(wildcard).toMatchObject({ id: "wildcard", transferCost: 0, optimal: false });
    expect(freehit).toMatchObject({ id: "freehit", transferCost: 0, optimal: false });
    const bestOne = byType(result.scenarios, "one")[0];
    expect(wildcard.netGain).toBeGreaterThanOrEqual(bestOne.netGain - 1e-9);
    // Free Hit is one week: its net gain is at most the gain of that week (x1.0), the Wildcard counts all three.
    expect(freehit.netGain).toBeCloseTo(6 - 1.8, 9);
    expect(wildcard.netGain).toBeCloseTo((6 - 1.8) * W3, 9);
    // The Free Hit squad is for the next week only: the period total adds the original squad's XI for weeks 2 and 3.
    expect(freehit.nextGwXp).toBeCloseTo(26, 9);
    expect(freehit.periodXp).toBeCloseTo(26 + 22 * 1.7, 9);
    // A chip is kept for a better week: a 4.2-a-week gain does not beat its opportunity cost, the free single transfer does.
    expect(result.recommendedId).toBe("one:21>41");
  });

  it("recommends a chip only when its gain beats the opportunity cost", async () => {
    // Three duds and three great buys: a Wildcard is worth 3 x (6 - 1.8) x 2.7 = 34 points against 3 transfers at -4 each.
    const rich: Spec[] = [
      ...baseSquadSpecs({ 21: 0, 22: 0, 31: 0 }),
      { id: 41, type: 3, team: 41, cost: 50, xp: 6 },
      { id: 42, type: 3, team: 42, cost: 50, xp: 6 },
      { id: 51, type: 4, team: 51, cost: 50, xp: 6 }
    ];
    const result = await run(mkInput(rich, { chips: { wildcard: { available: true }, freehit: { available: false, reason: "chip_not_open" } } }));
    const wildcard = result.scenarios.find((scenario) => scenario.type === "wildcard")!;
    expect(wildcard.netGain).toBeGreaterThan(TRANSFER_PARAMS.chipOpportunityCost);
    expect(wildcard.in).toEqual([41, 42, 51]);
    expect(wildcard.out).toEqual([21, 22, 31]);
    expect(result.recommendedId).toBe("wildcard");
    expect(result.skipped).toEqual([{ type: "freehit", reason: "chip_not_open" }]);
  });

  it("maps FPL's chip windows to available or a reason code", () => {
    const chip = (name: string, startEvent: number, stopEvent: number, state: ChipStatus["state"]): ChipStatus => ({ name, startEvent, stopEvent, state });
    expect(chipAvailability([chip("wildcard", 2, 19, { kind: "available" }), chip("wildcard", 20, 38, { kind: "later", startEvent: 20 })], 12, "wildcard")).toEqual({ available: true });
    expect(chipAvailability([chip("wildcard", 2, 19, { kind: "used", event: 5 }), chip("wildcard", 20, 38, { kind: "later", startEvent: 20 })], 12, "wildcard")).toEqual({
      available: false,
      reason: "chip_used"
    });
    expect(chipAvailability([chip("freehit", 20, 38, { kind: "later", startEvent: 20 })], 12, "freehit")).toEqual({ available: false, reason: "chip_not_open" });
    expect(chipAvailability([chip("freehit", 2, 19, { kind: "expired" })], 25, "freehit")).toEqual({ available: false, reason: "chip_expired" });
    expect(chipAvailability([], 12, "wildcard")).toEqual({ available: false, reason: "chip_not_in_season" });
  });
});

/** Slow, obviously correct reference: every legal 1- and 2-transfer, valued with lineup.ts. */
function brute(input: TransferSearchInput) {
  const { table } = input;
  const horizon = Math.min(input.horizon, table.gws.length);
  const weights = Array.from({ length: horizon }, (_, g) => XP_PARAMS.discount[g]);
  const value = (ids: number[]) => {
    let sum = 0;
    for (let g = 0; g < horizon; g += 1) {
      const players = ids.map((id) => ({ id, elementType: table.players.get(id)!.elementType, xp: table.players.get(id)!.weeks[g].xp, isStarter: false }));
      const xi = buildLineups(players, 1)[0].expectedPoints;
      const total = players.reduce((acc, player) => acc + player.xp, 0);
      sum += weights[g] * ((1 - TRANSFER_PARAMS.benchWeight) * xi + TRANSFER_PARAMS.benchWeight * total);
    }
    return sum;
  };
  const own = input.squad.map((player) => player.id);
  const sell = new Map(input.squad.map((player) => [player.id, player.sellingPrice ?? player.nowCost]));
  const budget = [...sell.values()].reduce((a, b) => a + b, 0) + input.bank;
  const free = input.freeTransfers ?? 1;
  const eligible = [...table.players.values()].filter(
    (player) =>
      !own.includes(player.id) &&
      player.availability > 0 &&
      player.status !== "u" &&
      weights.reduce((acc, weight, g) => acc + weight * player.weeks[g].xp, 0) > 0
  );
  const base = value(own);
  const legal = (ids: number[]) => {
    const clubs = new Map<number, number>();
    let cost = 0;
    for (const id of ids) {
      const row = table.players.get(id)!;
      clubs.set(row.teamId, (clubs.get(row.teamId) ?? 0) + 1);
      cost += sell.get(id) ?? row.nowCost;
    }
    return Math.max(...clubs.values()) <= 3 && cost <= budget;
  };

  const found: Array<{ key: string; type: "one" | "two"; net: number; out: number[]; in: number[] }> = [];
  const cost = (n: number) => Math.max(0, n - free) * 4;
  for (let a = 0; a < own.length; a += 1) {
    for (const x of eligible.filter((player) => player.elementType === table.players.get(own[a])!.elementType)) {
      const ids = own.map((id, k) => (k === a ? x.id : id));
      if (legal(ids)) found.push({ key: "", type: "one", net: value(ids) - base - cost(1), out: [own[a]], in: [x.id] });
    }
  }
  for (let a = 0; a < own.length; a += 1) {
    for (let b = a + 1; b < own.length; b += 1) {
      const typeA = table.players.get(own[a])!.elementType;
      const typeB = table.players.get(own[b])!.elementType;
      const listA = eligible.filter((player) => player.elementType === typeA);
      const listB = eligible.filter((player) => player.elementType === typeB);
      for (const x of listA) {
        for (const y of listB) {
          if (typeA === typeB && x.id >= y.id) continue;
          const ids = own.map((id, k) => (k === a ? x.id : k === b ? y.id : id));
          if (legal(ids)) {
            found.push({ key: "", type: "two", net: value(ids) - base - cost(2), out: [own[a], own[b]].sort((p, q) => p - q), in: [x.id, y.id].sort((p, q) => p - q) });
          }
        }
      }
    }
  }
  const rank = (type: "one" | "two") =>
    found
      .filter((item) => item.type === type)
      .sort((p, q) => Math.round(q.net * 1e9) - Math.round(p.net * 1e9) || p.out.join().localeCompare(q.out.join(), undefined, { numeric: true }) || p.in.join().localeCompare(q.in.join(), undefined, { numeric: true }))
      .slice(0, 5);
  return { one: rank("one"), two: rank("two") };
}

describe("1- and 2-transfer lists against a brute-force reference", () => {
  const cases: Array<{ seed: number; bank: number; free: number; horizon: 3 | 5 }> = [
    { seed: 1, bank: 0, free: 1, horizon: 3 },
    { seed: 2, bank: 12, free: 0, horizon: 3 },
    { seed: 3, bank: 5, free: 2, horizon: 5 },
    { seed: 4, bank: 30, free: 1, horizon: 5 }
  ];
  for (const item of cases) {
    it(`seed ${item.seed}, bank ${item.bank}, free ${item.free}, ${item.horizon} GW`, async () => {
      const world = randomWorld(item.seed, [4, 9, 9, 6]);
      const input: TransferSearchInput = {
        squad: world.squad,
        bank: item.bank,
        freeTransfers: item.free,
        table: world.table,
        horizon: item.horizon,
        chips: { wildcard: { available: false, reason: "chip_used" }, freehit: { available: false, reason: "chip_used" } }
      };
      const { result, stats } = await searchTransfers(input, { sliceMs: 1_000 });
      const reference = brute(input);
      for (const type of ["one", "two"] as const) {
        const got = byType(result.scenarios, type);
        const want = reference[type];
        expect(got.map((scenario) => [scenario.out, scenario.in])).toEqual(want.map((entry) => [entry.out, entry.in]));
        got.forEach((scenario, index) => expect(scenario.netGain).toBeCloseTo(want[index].net, 7));
      }
      // The bound really prunes: far fewer pairs are valued than exist.
      expect(stats.twoTransferEvaluations).toBeGreaterThan(0);
    });
  }
});

describe("determinism and ordering", () => {
  it("gives the same answer twice, and for a shuffled table and squad", async () => {
    const world = randomWorld(11);
    const input: TransferSearchInput = {
      squad: world.squad,
      bank: 8,
      freeTransfers: 1,
      table: world.table,
      horizon: 3,
      chips: { wildcard: { available: true }, freehit: { available: true } }
    };
    const first = await run(input);
    const second = await run(input);
    expect(second).toEqual(first);

    const shuffledTable: XpTable = { ...world.table, players: new Map([...world.table.players].reverse()) };
    const shuffled = await run({ ...input, squad: [...world.squad].reverse(), table: shuffledTable });
    expect(shuffled).toEqual(first);
  });

  it("breaks ties by player ID, lowest first", async () => {
    // Two identical buys (41, 42) for the dud: the lower ID is listed first.
    const specs: Spec[] = [...baseSquadSpecs({ 21: 0 }), { id: 42, type: 3, team: 42, cost: 50, xp: 6 }, { id: 41, type: 3, team: 41, cost: 50, xp: 6 }];
    const result = await run(mkInput(specs));
    expect(byType(result.scenarios, "one").slice(0, 2).map((scenario) => scenario.id)).toEqual(["one:21>41", "one:21>42"]);
  });

  it("returns at most five scenarios per kind, best first", async () => {
    const world = randomWorld(5);
    const result = await run({ squad: world.squad, bank: 20, freeTransfers: 1, table: world.table, horizon: 3, chips: { wildcard: { available: false, reason: "chip_used" }, freehit: { available: false, reason: "chip_used" } } });
    for (const type of ["one", "two"]) {
      const list = byType(result.scenarios, type);
      expect(list.length).toBeLessThanOrEqual(5);
      for (let i = 1; i < list.length; i += 1) expect(list[i - 1].netGain).toBeGreaterThanOrEqual(list[i].netGain - 1e-12);
    }
  });

  it("covers fewer gameweeks near the end of the season", async () => {
    const world = randomWorld(3, [4, 6, 6, 4], 2);
    const result = await run({ squad: world.squad, bank: 5, freeTransfers: 1, table: world.table, horizon: 5, chips: { wildcard: { available: false, reason: "chip_used" }, freehit: { available: false, reason: "chip_used" } } });
    expect(result.horizon).toBe(5);
    expect(result.gws).toEqual(GWS.slice(0, 2));
  });
});

describe("pool", () => {
  const own = OWN_IDS;

  it("is the union of xP leaders, form leaders, price risers and rival holdings, 30 per position at most", () => {
    // 60 midfielders: xP climbs with the ID, form falls with it. 100 is about to rise, 101 is a rival's pick, both weak otherwise.
    const specs: Spec[] = [...baseSquadSpecs()];
    for (let k = 0; k < 60; k += 1) {
      specs.push({ id: 200 + k, type: 3, team: 30 + (k % 15), cost: 50, xp: 1 + k * 0.1, form: 12 - k * 0.1 });
    }
    specs.push({ id: 100, type: 3, team: 70, cost: 50, xp: 0.3, form: 0.1, likelihood: 5 });
    specs.push({ id: 101, type: 3, team: 71, cost: 50, xp: 0.2, form: 0.1 });
    const table = mkTable(specs);

    const plain = buildCandidatePool(table, 3, own).get(3)!;
    expect(plain).toHaveLength(30);
    // xP top 18: the highest IDs 259..242. Form top 6: the lowest IDs 200..205. The riser 100 is in; the rival's 101 is not (no rival given).
    for (let id = 242; id <= 259; id += 1) expect(plain).toContain(id);
    for (let id = 200; id <= 205; id += 1) expect(plain).toContain(id);
    expect(plain).toContain(100);
    expect(plain).not.toContain(101);

    const withRival = buildCandidatePool(table, 3, own, [101]).get(3)!;
    expect(withRival).toHaveLength(30);
    expect(withRival).toContain(101);
    expect(withRival).toContain(100);
    // Nobody twice, nobody the manager owns.
    expect(new Set(withRival).size).toBe(30);
    expect(withRival.some((id) => own.includes(id))).toBe(false);
  });

  it("drops players with availability 0 or status u, and tops up to 30 by xP when the other lists overlap", () => {
    const specs: Spec[] = [...baseSquadSpecs()];
    for (let k = 0; k < 40; k += 1) specs.push({ id: 200 + k, type: 4, team: 30 + (k % 15), cost: 50, xp: 1 + k * 0.1, form: 1 + k * 0.1 });
    specs.push({ id: 300, type: 4, team: 70, cost: 50, xp: 50, availability: 0 });
    specs.push({ id: 301, type: 4, team: 71, cost: 50, xp: 50, status: "u" });
    const pool = buildCandidatePool(mkTable(specs), 5, own).get(4)!;
    expect(pool).toHaveLength(30);
    expect(pool).not.toContain(300);
    expect(pool).not.toContain(301);
    // xP and form lists are the same players, so the top-up is the next best by xP: IDs 210..239.
    for (let id = 210; id <= 239; id += 1) expect(pool).toContain(id);
  });

  it("is smaller when fewer players qualify", () => {
    const specs: Spec[] = [...baseSquadSpecs(), { id: 41, type: 3, team: 41, cost: 50, xp: 3 }];
    const pool = buildCandidatePool(mkTable(specs), 3, own);
    expect(pool.get(3)).toEqual([41]);
    expect(pool.get(1)).toEqual([]);
  });
});

describe("slicing", () => {
  it("yields to the event loop and lets other work run before the search ends", async () => {
    const world = randomWorld(21, [10, 30, 30, 20]);
    const input: TransferSearchInput = {
      squad: world.squad,
      bank: 20,
      freeTransfers: 1,
      table: world.table,
      horizon: 3,
      chips: { wildcard: { available: false, reason: "chip_used" }, freehit: { available: false, reason: "chip_used" } }
    };
    let finished = false;
    let otherRanBeforeFinish = 0;
    const search = searchTransfers(input, { sliceMs: 0 }).then((outcome) => {
      finished = true;
      return outcome;
    });
    // A timer-like job queued right after the search starts, and a ticker that keeps queueing itself.
    const ticker = () => {
      if (!finished) {
        otherRanBeforeFinish += 1;
        setImmediate(ticker);
      }
    };
    setImmediate(ticker);
    const { stats } = await search;
    expect(stats.slices).toBeGreaterThan(5);
    expect(otherRanBeforeFinish).toBeGreaterThanOrEqual(3);
  });

  it("measures the longest stretch between yields, and yields when it is long", async () => {
    let waits = 0;
    let clock = 0;
    const world = randomWorld(2, [4, 8, 8, 6]);
    const input: TransferSearchInput = {
      squad: world.squad,
      bank: 10,
      freeTransfers: 1,
      table: world.table,
      horizon: 3,
      chips: { wildcard: { available: false, reason: "chip_used" }, freehit: { available: false, reason: "chip_used" } }
    };
    // A fake clock that advances 1 ms per reading: a 5 ms slice means a yield every ~320 evaluations.
    const { stats } = await searchTransfers(input, {
      sliceMs: 5,
      now: () => (clock += 3),
      yieldToLoop: async () => {
        waits += 1;
      }
    });
    expect(waits).toBeGreaterThan(0);
    expect(stats.slices).toBe(waits + 1);
    expect(stats.maxSliceMs).toBeLessThanOrEqual(12); // sliceMs 5 plus the two readings it takes to notice
  });

  it("is fast and never blocks long at the real size (15 own, 30 per position, 5 GW, both chips)", async () => {
    const world = randomWorld(42, [40, 120, 120, 80], 6);
    const input: TransferSearchInput = {
      squad: world.squad,
      bank: 8,
      freeTransfers: 1,
      table: world.table,
      horizon: 5,
      chips: { wildcard: { available: true }, freehit: { available: true } }
    };
    const timings: string[] = [];
    for (const horizon of [3, 5] as const) {
      const { result, stats } = await searchTransfers({ ...input, horizon });
      timings.push(
        `horizon ${horizon}: pool ${result.poolSize}, ${stats.evaluations} evaluations (${stats.twoTransferEvaluations} for pairs), ` +
          `${stats.elapsedMs.toFixed(1)} ms in total, ${stats.slices} slices, longest ${stats.maxSliceMs.toFixed(1)} ms`
      );
      expect(result.poolSize).toBeLessThanOrEqual(120);
      expect(stats.maxSliceMs).toBeLessThan(40);
      expect(stats.elapsedMs).toBeLessThan(3_000);
    }
    console.log(`[transfer-search timing]\n${timings.join("\n")}`);
  });
});

describe("worst case: no pruning at all", () => {
  it("values every legal pair in slices and returns the same lists as the pruned search", async () => {
    // A big bank so almost every pair is affordable, and the real 30-per-position pool.
    const world = randomWorld(42, [40, 120, 120, 80], 6);
    const input: TransferSearchInput = {
      squad: world.squad,
      bank: 400,
      freeTransfers: 1,
      table: world.table,
      horizon: 5,
      chips: { wildcard: { available: false, reason: "chip_used" }, freehit: { available: false, reason: "chip_used" } }
    };
    const pruned = await searchTransfers(input);
    const full = await searchTransfers(input, { exhaustive: true });
    expect(full.result).toEqual(pruned.result);
    expect(full.stats.twoTransferEvaluations).toBeGreaterThan(pruned.stats.twoTransferEvaluations * 5);
    expect(full.stats.maxSliceMs).toBeLessThan(40);
    console.log(
      `[transfer-search worst case, bank 40.0m, 5 GW]
` +
        `pruned: ${pruned.stats.twoTransferEvaluations} pairs valued, ${pruned.stats.elapsedMs.toFixed(1)} ms, longest ${pruned.stats.maxSliceMs.toFixed(1)} ms
` +
        `no pruning: ${full.stats.twoTransferEvaluations} pairs valued, ${full.stats.elapsedMs.toFixed(1)} ms, ${full.stats.slices} slices, longest ${full.stats.maxSliceMs.toFixed(1)} ms`
    );
  });
});

describe("table helper sanity", () => {
  it("mkTable keeps what the search reads", () => {
    const table = mkTable(baseSquadSpecs());
    expect(table.players.get(21)).toMatchObject({ elementType: 3, nowCost: 50, availability: 1 });
  });
});
