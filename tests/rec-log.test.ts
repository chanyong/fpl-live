import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { AiInput } from "@/lib/ai/input-bundle";
import {
  FILL_PER_REQUEST,
  WRITE_INTERVAL_MS,
  actualTransfer,
  buildRulesSummary,
  computeActual,
  readRecommendationLog,
  recordRecommendation,
  resetRecordThrottle,
  summariseAi,
  type AiLogSummary,
  type RulesSummary
} from "@/lib/ai/rec-log";
import type { StoredJob } from "@/lib/ai/store";
import type { EntryRecommendPayload } from "@/lib/xp/recommend";
import { TEAM, answerText, makeAiInput, validAnswer } from "./helpers/ai";
import { DEADLINE, MemoryLogStore, NOW, NO_AI_JOBS, makeLogDeps, mkPoints, mkSummary } from "./helpers/rec-log";

// Issue #43 stage 5: the recommendation log. Memory fakes only: no database, no FPL call, no paid call.
let input: AiInput;
let payload: EntryRecommendPayload;
beforeAll(async () => {
  const made = await makeAiInput();
  input = made.input;
  payload = made.payload;
});
beforeEach(() => {
  resetRecordThrottle();
});

describe("buildRulesSummary", () => {
  it("keeps captains 1-3, L1, the one- and two-transfer leaders, the recommended scenario, bank and free transfers", () => {
    const summary = buildRulesSummary(payload, DEADLINE, NOW)!;
    expect(summary).toMatchObject({ v: 1, targetGw: payload.targetGw, squadGw: payload.squadGw, deadlineAt: new Date(DEADLINE).toISOString() });
    expect(summary.captains).toEqual(payload.captains.slice(0, 3).map((c) => ({ id: c.id, xp: c.xp, weightPct: c.weightPct })));
    expect(summary.lineup.starters).toEqual(payload.lineups[0].starters);
    expect(summary.lineup.bench).toEqual(payload.lineups[0].bench);
    expect(summary.lineup.expectedPoints).toBe(payload.lineups[0].expectedPoints);
    expect(summary.lineup.currentExpectedPoints).toBe(payload.lineups[0].currentExpectedPoints);
    expect(summary.squad).toHaveLength(15);

    const scenarios = payload.transfers!.scenarios;
    const one = scenarios.find((s) => s.type === "one")!;
    const two = scenarios.find((s) => s.type === "two")!;
    expect(summary.transfers).toMatchObject({
      freeTransfers: payload.transfers!.freeTransfers,
      bank: payload.transfers!.bank,
      recommendedId: payload.transfers!.recommendedId,
      one: { id: one.id, out: one.out, in: one.in, netGain: one.netGain, transferCost: one.transferCost },
      two: { id: two.id, out: two.out, in: two.in, netGain: two.netGain }
    });
    // Names of the squad and of the players a scenario brings in.
    expect(summary.names[String(payload.captains[0].id)]).toMatch(/^Zorro/);
    for (const id of [...one.in, ...two.in]) expect(summary.names[String(id)]).toBeDefined();
  });

  it("has no transfer block when the team has no scenarios, and nothing to record without a lineup", () => {
    expect(buildRulesSummary({ ...payload, transfers: null }, DEADLINE, NOW)!.transfers).toBeNull();
    expect(buildRulesSummary({ ...payload, lineups: [] }, DEADLINE, NOW)).toBeNull();
  });
});

describe("recordRecommendation", () => {
  it("writes the summary for the allowed team when the target gameweek is still open", async () => {
    const { deps, store } = makeLogDeps({ open: { gw: payload.targetGw, deadlineAt: DEADLINE } });
    expect(await recordRecommendation(payload, deps)).toBe("written");
    const row = store!.rows.get(`${TEAM}:${payload.targetGw}`)!;
    expect(row.modelVersion).toBe("xp1");
    expect((row.rulesSummary as RulesSummary).captains).toHaveLength(3);
    expect(row.actualResult).toBeNull();
  });

  it("touches nothing for a team that is not allowed: no database access at all", async () => {
    const { deps, store, openDeadline } = makeLogDeps();
    expect(await recordRecommendation({ ...payload, entryId: 777 }, deps)).toBe("not_allowed");
    expect(store!.calls).toBe(0);
    expect(openDeadline).not.toHaveBeenCalled();
  });

  it("skips quietly without Supabase settings (no store)", async () => {
    const { deps, openDeadline } = makeLogDeps({ store: null });
    expect(await recordRecommendation(payload, deps)).toBe("no_store");
    expect(openDeadline).not.toHaveBeenCalled();
  });

  it("never throws when the write fails (missing table, dead connection) and does not retry within the window", async () => {
    const { deps, store } = makeLogDeps({ open: { gw: payload.targetGw, deadlineAt: DEADLINE } });
    store!.failOn = "upsert";
    expect(await recordRecommendation(payload, deps)).toBe("failed");
    expect(await recordRecommendation(payload, deps)).toBe("throttled");
    expect(store!.calls).toBe(1);
  });

  it("writes a (team, gameweek) once per 10 minutes, then overwrites with the last visit's values", async () => {
    let now = NOW;
    const { deps, store } = makeLogDeps({ now: () => now, open: { gw: payload.targetGw, deadlineAt: DEADLINE } });
    expect(await recordRecommendation(payload, deps)).toBe("written");
    now += 9 * 60_000;
    expect(await recordRecommendation(payload, deps)).toBe("throttled");
    expect(store!.upserts).toBe(1);

    now = NOW + WRITE_INTERVAL_MS;
    const changed = { ...payload, captains: [...payload.captains].reverse() };
    expect(await recordRecommendation(changed, deps)).toBe("written");
    expect(store!.upserts).toBe(2);
    expect(store!.rows.size).toBe(1);
    expect((store!.rows.get(`${TEAM}:${payload.targetGw}`)!.rulesSummary as RulesSummary).captains[0].id).toBe(changed.captains[0].id);
  });

  it("keeps a filled real result when the summary is overwritten", async () => {
    let now = NOW;
    const { deps, store } = makeLogDeps({ now: () => now, open: { gw: payload.targetGw, deadlineAt: DEADLINE } });
    await recordRecommendation(payload, deps);
    store!.rows.get(`${TEAM}:${payload.targetGw}`)!.actualResult = { v: 1 };
    now += WRITE_INTERVAL_MS;
    await recordRecommendation(payload, deps);
    expect(store!.rows.get(`${TEAM}:${payload.targetGw}`)!.actualResult).toEqual({ v: 1 });
  });

  it("does not overwrite once the deadline has passed, and not when the open gameweek is another one", async () => {
    const after = makeLogDeps({ now: () => DEADLINE, open: { gw: payload.targetGw, deadlineAt: DEADLINE } });
    expect(await recordRecommendation(payload, after.deps)).toBe("closed");
    expect(after.store!.upserts).toBe(0);

    resetRecordThrottle();
    const other = makeLogDeps({ open: { gw: payload.targetGw + 1, deadlineAt: DEADLINE } });
    expect(await recordRecommendation(payload, other.deps)).toBe("no_deadline");
    resetRecordThrottle();
    const unknown = makeLogDeps({ open: null });
    expect(await recordRecommendation(payload, unknown.deps)).toBe("no_deadline");
    expect(other.store!.upserts + unknown.store!.upserts).toBe(0);
  });

  it("adds the AI's captain, lineup and first transfer from a stored answer under the ai key", async () => {
    const answer = validAnswer(input);
    const job: StoredJob = {
      id: "j1", generation: 2, kind: "manual", status: "done", result: JSON.parse(answerText(answer)), basis: input.basis,
      failureCode: null, modelId: "m", modelVersion: "xp1", createdAt: "2026-11-22T10:00:00.000Z", completedAt: "2026-11-22T10:05:00.000Z"
    };
    const aiLatest = vi.fn(async (key: { locale: "ko" | "en" }) => (key.locale === "en" ? { ...NO_AI_JOBS, done: job } : NO_AI_JOBS));
    const { deps, store } = makeLogDeps({ open: { gw: payload.targetGw, deadlineAt: DEADLINE }, aiLatest });
    await recordRecommendation(payload, deps);

    const ai = (store!.rows.get(`${TEAM}:${payload.targetGw}`)!.rulesSummary as RulesSummary).ai!;
    expect(ai).toMatchObject({ generation: 2, locale: "en", captains: [answer.captain[0].player_id, answer.captain[1].player_id], lineupId: "L1" });
    expect(ai.lineup!.starters).toEqual(input.basis.lineups[0].starters);
    expect(ai.transferId).toBe(answer.transfers[0].scenario_id);
    expect(ai.transfer!.id).toBe(answer.transfers[0].scenario_id);
  });

  it("leaves the ai key out when the AI store fails or has no finished answer", async () => {
    const failing = makeLogDeps({ open: { gw: payload.targetGw, deadlineAt: DEADLINE }, aiLatest: async () => { throw new Error("down"); } });
    expect(await recordRecommendation(payload, failing.deps)).toBe("written");
    expect((failing.store!.rows.get(`${TEAM}:${payload.targetGw}`)!.rulesSummary as RulesSummary).ai).toBeUndefined();
    resetRecordThrottle();
    const none = makeLogDeps({ open: { gw: payload.targetGw, deadlineAt: DEADLINE }, aiLatest: async () => NO_AI_JOBS });
    await recordRecommendation(payload, none.deps);
    expect((none.store!.rows.get(`${TEAM}:${payload.targetGw}`)!.rulesSummary as RulesSummary).ai).toBeUndefined();
  });
});

describe("summariseAi", () => {
  it("ignores an unusable stored answer", () => {
    const bad = { id: "j", generation: 1, kind: "first", status: "done", result: null, basis: {}, failureCode: null, modelId: "m", modelVersion: "xp1", createdAt: "", completedAt: null } as StoredJob;
    expect(summariseAi(bad, "ko", NOW)).toBeNull();
    expect(summariseAi({ ...bad, result: { captain: [], lineup: { option_id: "L1", reason: "" } } }, "ko", NOW)).toBeNull();
  });
});

describe("computeActual (a week solved by hand)", () => {
  it("scores the captains and says whether the numbers' first pick was the best of the candidates", () => {
    const actual = computeActual(mkSummary(), { points: mkPoints(), picks: null }, NOW);
    expect(actual.captains).toEqual([{ id: 31, points: 10 }, { id: 21, points: 5 }, { id: 22, points: 6 }]);
    expect(actual.captainTop).toEqual({ id: 31, points: 10, bestAmongCandidates: true });

    // The first pick scored 5, a later candidate 10: not the best.
    const missed = computeActual(mkSummary({ captains: [{ id: 21, xp: 7, weightPct: 50 }, { id: 31, xp: 6, weightPct: 30 }] }), { points: mkPoints(), picks: null }, NOW);
    expect(missed.captainTop).toEqual({ id: 21, points: 5, bestAmongCandidates: false });
    // A tie for the highest counts as the best.
    const tie = computeActual(mkSummary(), { points: mkPoints({ 21: 10 }), picks: null }, NOW);
    expect(computeActual(mkSummary({ captains: [{ id: 21, xp: 7, weightPct: 50 }, { id: 31, xp: 6, weightPct: 50 }] }), { points: mkPoints({ 21: 10 }), picks: null }, NOW).captainTop!.bestAmongCandidates).toBe(true);
    expect(tie.captainTop!.bestAmongCandidates).toBe(true);
  });

  it("compares L1's eleven (50) with the best eleven of the same 15 (72)", () => {
    const { lineup } = computeActual(mkSummary(), { points: mkPoints(), picks: null }, NOW);
    expect(lineup).toEqual({ points: 50, optimalPoints: 72, ratio: 50 / 72 });
    expect(Math.round(lineup!.ratio! * 100)).toBe(69);
  });

  it("has no ratio when the whole squad scored nothing", () => {
    const zero = new Map<number, number>();
    expect(computeActual(mkSummary(), { points: zero, picks: null }, NOW).lineup).toEqual({ points: 0, optimalPoints: 0, ratio: null });
  });

  it("scores a transfer as points in minus points out minus the cost, and leaves chips and rolls out of it", () => {
    const { transfers } = computeActual(mkSummary(), { points: mkPoints(), picks: null }, NOW);
    // 41 scored 11, 25 scored 1, no cost.
    expect(transfers!.one).toEqual({ id: "one:25>41", type: "one", inPoints: 11, outPoints: 1, cost: 0, net: 10 });
    // 42 (8) + 43 (0) in, 14 (4) + 24 (8) out, a 4-point cost: 8 - 12 - 4.
    expect(transfers!.two).toMatchObject({ inPoints: 8, outPoints: 12, cost: 4, net: -8 });
    expect(transfers!.recommended!.net).toBe(10);

    const points = mkPoints();
    expect(actualTransfer({ id: "roll", type: "roll", out: [], in: [], transferCost: 0, netGain: 0 }, points)!.net).toBe(0);
    expect(actualTransfer({ id: "wildcard", type: "wildcard", out: [1], in: [41], transferCost: 0, netGain: 5 }, points)).toBeNull();
    expect(actualTransfer(null, points)).toBeNull();
  });

  it("keeps what the manager really did that week", () => {
    const { manager } = computeActual(mkSummary(), { points: mkPoints(), picks: { captainId: 33, multiplier: 2, points: 58, transferCost: 4 } }, NOW);
    expect(manager).toEqual({ captainId: 33, captainPoints: 12, multiplier: 2, points: 58, transferCost: 4 });
  });

  const aiSummary = (overrides: Partial<AiLogSummary>): AiLogSummary => ({
    generation: 1, locale: "ko", captains: [31], lineupId: "L1", lineup: null, transferId: null, transfer: null, recordedAt: "2026-11-22T12:00:00.000Z", ...overrides
  });
  const l2 = { formation: "4-4-2", starters: [2, 15, 12, 13, 14, 21, 22, 23, 24, 31, 33], bench: [1, 11, 25, 32], expectedPoints: 1 };

  it("AI vs the numbers: better", () => {
    // AI captain 33 scored 12 against the numbers' 10; its eleven scored 72 against 50; its transfer "one" nets +10 against a rolled week.
    const summary = mkSummary({
      ai: aiSummary({ captains: [33], lineup: l2, transferId: "one:25>41", transfer: { id: "one:25>41", type: "one", out: [25], in: [41], transferCost: 0, netGain: 3 } }),
      transfers: { ...mkSummary().transfers!, recommendedId: "roll", recommended: { id: "roll", type: "roll", out: [], in: [], transferCost: 0, netGain: 0 } }
    });
    const { ai } = computeActual(summary, { points: mkPoints(), picks: null }, NOW);
    expect(ai!.captain).toEqual({ id: 33, points: 12, vs: "better" });
    expect(ai!.lineup).toEqual({ points: 6 + 9 + 2 + 3 + 4 + 5 + 6 + 7 + 8 + 10 + 12, vs: "better" });
    expect(ai!.transfer).toEqual({ id: "one:25>41", net: 10, vs: "better" });
  });

  it("AI vs the numbers: same", () => {
    const summary = mkSummary({
      ai: aiSummary({
        captains: [31],
        lineup: { ...l2, starters: mkSummary().lineup.starters },
        transferId: "one:25>41",
        transfer: { id: "one:25>41", type: "one", out: [25], in: [41], transferCost: 0, netGain: 3 }
      })
    });
    const { ai } = computeActual(summary, { points: mkPoints(), picks: null }, NOW);
    expect(ai).toMatchObject({ captain: { vs: "same" }, lineup: { points: 50, vs: "same" }, transfer: { net: 10, vs: "same" } });
  });

  it("AI vs the numbers: worse, and nothing to compare when the AI's pick is a chip", () => {
    const summary = mkSummary({
      ai: aiSummary({
        captains: [21],
        lineup: { ...l2, starters: [1, 11, 12, 13, 14, 21, 22, 23, 24, 25, 32] },
        transferId: "roll",
        transfer: { id: "roll", type: "roll", out: [], in: [], transferCost: 0, netGain: 0 }
      })
    });
    const { ai } = computeActual(summary, { points: mkPoints(), picks: null }, NOW);
    expect(ai!.captain).toEqual({ id: 21, points: 5, vs: "worse" });
    expect(ai!.lineup).toMatchObject({ points: 2 + 1 + 2 + 3 + 4 + 5 + 6 + 7 + 8 + 1 + 2, vs: "worse" });
    // Rolled (0) against the numbers' +10 transfer.
    expect(ai!.transfer).toEqual({ id: "roll", net: 0, vs: "worse" });

    const chip = mkSummary({ ai: aiSummary({ transferId: "wildcard", transfer: { id: "wildcard", type: "wildcard", out: [1], in: [41], transferCost: 0, netGain: 9 } }) });
    expect(computeActual(chip, { points: mkPoints(), picks: null }, NOW).ai!.transfer).toBeNull();
  });

  it("has no ai block when the summary has no AI part", () => {
    expect(computeActual(mkSummary(), { points: mkPoints(), picks: null }, NOW).ai).toBeUndefined();
  });
});

describe("readRecommendationLog", () => {
  const seed = (store: MemoryLogStore, gws: number[], summary: RulesSummary = mkSummary()) => {
    for (const gw of gws) store.put({ entryId: TEAM, targetGw: gw, rulesSummary: { ...summary, targetGw: gw } });
  };

  it("is empty for a team that is not allowed, without any database access", async () => {
    const { deps, store } = makeLogDeps();
    expect(await readRecommendationLog(777, deps)).toEqual([]);
    expect(store!.calls).toBe(0);
  });

  it("is empty without a store, and when the read fails", async () => {
    expect(await readRecommendationLog(TEAM, makeLogDeps({ store: null }).deps)).toEqual([]);
    const failing = makeLogDeps();
    failing.store!.failOn = "list";
    expect(await readRecommendationLog(TEAM, failing.deps)).toEqual([]);
  });

  it("lists the newest gameweeks first, at most ten", async () => {
    const { deps, store } = makeLogDeps();
    seed(store!, Array.from({ length: 12 }, (_, index) => index + 1));
    const entries = await readRecommendationLog(TEAM, deps);
    expect(entries.map((entry) => entry.targetGw)).toEqual([12, 11, 10, 9, 8, 7, 6, 5, 4, 3]);
  });

  it("fills a finished gameweek with its real result once: one live and one picks read, then it is stored", async () => {
    const actual = vi.fn(async () => ({ points: mkPoints(), picks: null }));
    const { deps, store, fetchActual } = makeLogDeps({ finished: [11], actual });
    seed(store!, [11, 12]);

    const first = await readRecommendationLog(TEAM, deps);
    expect(fetchActual).toHaveBeenCalledTimes(1);
    expect(fetchActual).toHaveBeenCalledWith(TEAM, 11);
    expect(first.find((entry) => entry.targetGw === 11)!.actual!.lineup!.points).toBe(50);
    // The open gameweek has no result yet.
    expect(first.find((entry) => entry.targetGw === 12)!.actual).toBeNull();
    expect(store!.rows.get(`${TEAM}:11`)!.actualResult).not.toBeNull();

    await readRecommendationLog(TEAM, deps);
    expect(fetchActual).toHaveBeenCalledTimes(1);
  });

  it("fills at most two gameweeks per request, newest first", async () => {
    const { deps, store, fetchActual } = makeLogDeps({ finished: [5, 6, 7, 8], actual: async () => ({ points: mkPoints(), picks: null }) });
    seed(store!, [5, 6, 7, 8]);
    const entries = await readRecommendationLog(TEAM, deps);
    expect(FILL_PER_REQUEST).toBe(2);
    expect(fetchActual.mock.calls.map((call) => call[1])).toEqual([8, 7]);
    expect(entries.filter((entry) => entry.actual).map((entry) => entry.targetGw)).toEqual([8, 7]);

    await readRecommendationLog(TEAM, deps);
    expect(fetchActual.mock.calls.map((call) => call[1])).toEqual([8, 7, 6, 5]);
  });

  it("leaves a gameweek waiting when FPL fails, and still answers", async () => {
    const { deps, store } = makeLogDeps({ finished: [11], actual: async () => { throw new Error("FPL down"); } });
    seed(store!, [11]);
    const entries = await readRecommendationLog(TEAM, deps);
    expect(entries).toHaveLength(1);
    expect(entries[0].actual).toBeNull();
  });

  it("still shows the computed result when saving it fails, and does not ask FPL when no finished-gameweek list is known", async () => {
    const saving = makeLogDeps({ finished: [11], actual: async () => ({ points: mkPoints(), picks: null }) });
    seed(saving.store!, [11]);
    saving.store!.failOn = "set-actual";
    expect((await readRecommendationLog(TEAM, saving.deps))[0].actual).not.toBeNull();

    const unknown = makeLogDeps({ finished: null });
    seed(unknown.store!, [11]);
    await readRecommendationLog(TEAM, unknown.deps);
    expect(unknown.fetchActual).not.toHaveBeenCalled();
  });

  it("skips rows whose stored summary is not readable", async () => {
    const { deps, store } = makeLogDeps();
    store!.put({ entryId: TEAM, targetGw: 3, rulesSummary: { nonsense: true } });
    seed(store!, [4]);
    expect((await readRecommendationLog(TEAM, deps)).map((entry) => entry.targetGw)).toEqual([4]);
  });
});
