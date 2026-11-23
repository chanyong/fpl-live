import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { maxCostFullCallUsd, maxCostPerCallUsd } from "@/lib/ai/budget";
import { FULL_INPUT_TOKEN_CEILING, FULL_MAX_TOKENS } from "@/lib/ai/config";
import { readFullAi, requestFullAi } from "@/lib/ai/full-flow";
import { FullUnavailableError, type FullInput } from "@/lib/ai/full-input";
import { validateFullOutput, type FullContext } from "@/lib/ai/full-schema";
import type { AiInput } from "@/lib/ai/input-bundle";
import { readEntryAi } from "@/lib/ai/recommend";
import type { EntryRecommendPayload } from "@/lib/xp/recommend";
import { DISABLED, FakeClient, FakeStore, TEAM, answerText, makeAiInput, makeDeps, makeFullInput, okResponse, validAnswer, validFullAnswer } from "./helpers/ai";

// Issue #85: the "full AI" mode. The model chooses the lineup and the transfers; the server checks the FPL rules.
// Fakes only: no network, no database.
let full: FullInput;
let ranking: AiInput;
let payload: EntryRecommendPayload;
beforeAll(async () => {
  const made = await makeFullInput();
  full = made.full;
  payload = made.payload;
  ranking = (await makeAiInput()).input;
});
beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => vi.restoreAllMocks());

const check = (answer: unknown, ctx: FullContext = full.context) => validateFullOutput(answer, ctx);
const code = (answer: unknown, ctx?: FullContext) => {
  const out = check(answer, ctx);
  return out.ok ? "ok" : out.code;
};
/** The context with one player fact changed (a copy: the shared one stays as it was). */
const withPlayer = (id: number, patch: Partial<{ type: number; club: string; price: number }>): FullContext => {
  const players = new Map(full.context.players);
  players.set(id, { ...players.get(id)!, ...patch });
  return { ...full.context, players };
};

describe("the rule checker of a full-AI answer", () => {
  it("accepts a legal plan and works out the figures itself", () => {
    const out = check(validFullAnswer());
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    const plan = out.value;
    expect(plan.transfers).toEqual([{ out: 21, in: 42 }]);
    expect(plan.lineup.formation).toBe("4-4-2");
    expect(plan.lineup.starters).toEqual([1, 11, 12, 13, 14, 22, 23, 24, 42, 31, 32]);
    expect(plan.lineup.bench).toEqual([2, 15, 25, 33]);
    expect(plan.lineup.captainId).toBe(42);
    expect(plan.lineup.incoming).toEqual([42]);
    // 1 free transfer, 1 made: no cost. Bank 0.1 + sold 5.0 - bought 5.1 = 0.
    expect(plan.money).toEqual({ transferCost: 0, freeTransfers: 1, bankAfter: 0 });
    // The names replace the placeholders; one line for each of the 15 and for the player sold.
    expect(plan.summary).toContain("Zorro21");
    expect(plan.reasons).toHaveLength(16);
    expect(plan.reasons.filter((reason) => reason.role === "out").map((reason) => reason.playerId)).toEqual([21]);
    expect(plan.reasons.find((reason) => reason.playerId === 42)?.incoming).toBe(true);
  });

  it("accepts 'no transfer' and a plan with the same squad", () => {
    const answer = validFullAnswer({
      transfers: [],
      starters: [1, 11, 12, 13, 14, 22, 23, 24, 25, 31, 32],
      bench: [2, 15, 21, 33],
      captain_id: 22,
      vice_captain_id: 25,
      reasons: [1, 2, 11, 12, 13, 14, 15, 21, 22, 23, 24, 25, 31, 32, 33].map((id) => ({ player_id: id, reason: "Keeps his place this week." }))
    });
    const out = check(answer);
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.value.money).toMatchObject({ transferCost: 0, bankAfter: 1 });
  });

  it("charges 4 points for each transfer beyond the free ones, and nothing under a chip", () => {
    const two = validFullAnswer({
      transfers: [
        { out_id: 21, in_id: 42 },
        { out_id: 22, in_id: 41 }
      ],
      starters: [1, 11, 12, 13, 14, 23, 24, 41, 42, 31, 32],
      bench: [2, 15, 25, 33],
      captain_id: 42,
      vice_captain_id: 41,
      reasons: [1, 2, 11, 12, 13, 14, 15, 21, 22, 23, 24, 25, 31, 32, 33, 41, 42].map((id) => ({ player_id: id, reason: "A plain reason." }))
    });
    // 15 - 2 + 2 players: 13 kept + 41 + 42 = 15, and the two sold need lines too: 17 reasons.
    const out = check(two, { ...full.context, bank: 20, freeTransfers: 1 });
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.value.money.transferCost).toBe(4);
    const free = check(two, { ...full.context, bank: 20, freeTransfers: 2 });
    expect(free.ok && free.value.money.transferCost).toBe(0);
    const chip = check({ ...two, chip: "wildcard" }, { ...full.context, bank: 20, freeTransfers: 1, chips: { wildcard: true, freehit: false } });
    expect(chip.ok && chip.value.money.transferCost).toBe(0);
  });

  it("refuses a chip that cannot be played, and more than two transfers without one", () => {
    expect(code(validFullAnswer({ chip: "wildcard" }), { ...full.context, chips: { wildcard: false, freehit: true } })).toBe("chip_unavailable");
    expect(code(validFullAnswer({ chip: "freehit" }), { ...full.context, chips: { wildcard: true, freehit: false } })).toBe("chip_unavailable");
    const three = validFullAnswer({
      transfers: [
        { out_id: 21, in_id: 42 },
        { out_id: 22, in_id: 41 },
        { out_id: 11, in_id: 43 }
      ]
    });
    expect(code(three)).toBe("too_many_transfers");
  });

  it("refuses transfers that do not make sense", () => {
    expect(code(validFullAnswer({ transfers: [{ out_id: 999, in_id: 42 }] }))).toBe("out_not_in_squad");
    expect(code(validFullAnswer({ transfers: [{ out_id: 21, in_id: 22 }] }))).toBe("in_already_in_squad");
    expect(code(validFullAnswer({ transfers: [{ out_id: 21, in_id: 987654 }] }))).toBe("unknown_in_player");
    expect(
      code(
        validFullAnswer({
          transfers: [
            { out_id: 21, in_id: 42 },
            { out_id: 21, in_id: 41 }
          ]
        })
      )
    ).toBe("duplicate_transfer_player");
  });

  it("refuses a squad that is not 2 GK, 5 DEF, 5 MID, 3 FWD", () => {
    // A midfielder out and a defender in: six defenders.
    const answer = validFullAnswer({
      transfers: [{ out_id: 21, in_id: 43 }],
      starters: [1, 11, 12, 13, 14, 22, 23, 24, 43, 31, 32]
    });
    expect(code(answer)).toBe("squad_composition");
  });

  it("refuses a fourth player from one club", () => {
    const ctx = withPlayer(22, { club: "X" });
    const players = new Map(ctx.players);
    for (const id of [23, 24, 42]) players.set(id, { ...players.get(id)!, club: "X" });
    expect(code(validFullAnswer(), { ...ctx, players })).toBe("club_limit");
    // Three from one club is fine.
    const three = new Map(ctx.players);
    for (const id of [23, 24]) three.set(id, { ...three.get(id)!, club: "X" });
    expect(code(validFullAnswer(), { ...ctx, players: three })).toBe("ok");
  });

  it("refuses a transfer the money does not cover, using the selling price and the bank", () => {
    // 42 costs 5.1m: sold 5.0m + bank 0.1m exactly covers it; 5.2m does not.
    expect(code(validFullAnswer(), withPlayer(42, { price: 51 }))).toBe("ok");
    expect(code(validFullAnswer(), withPlayer(42, { price: 52 }))).toBe("over_budget");
    // The selling price, not the current price, is what comes back: a player bought at 5.0m, now 6.0m, sells for 5.5m.
    const sell = new Map(full.context.sell);
    sell.set(21, 45);
    expect(code(validFullAnswer(), { ...full.context, sell })).toBe("over_budget");
  });

  it("refuses a lineup that is not eleven and four from the new fifteen", () => {
    expect(code(validFullAnswer({ starters: [1, 11, 12, 13, 14, 22, 23, 24, 42, 31] }))).toBe("lineup_size");
    expect(code(validFullAnswer({ starters: [1, 11, 12, 13, 14, 22, 23, 24, 42, 31, 31] }))).toBe("lineup_duplicate_player");
    // 21 was sold: it cannot start.
    expect(code(validFullAnswer({ starters: [1, 11, 12, 13, 14, 22, 23, 24, 21, 31, 32] }))).toBe("lineup_player_not_in_squad");
  });

  it("refuses an illegal formation and a bench that does not open with a goalkeeper", () => {
    // 5-5-... 1 GK, 5 DEF, 4 MID, 1 FWD is legal (5-4-1); 2 DEF is not.
    expect(code(validFullAnswer({ starters: [1, 11, 12, 22, 23, 24, 25, 42, 31, 32, 33], bench: [2, 13, 14, 15] }))).toBe("formation");
    // Two goalkeepers starting.
    expect(code(validFullAnswer({ starters: [1, 2, 11, 12, 13, 22, 23, 24, 42, 31, 32], bench: [14, 15, 25, 33] }))).toBe("formation");
    expect(code(validFullAnswer({ bench: [15, 2, 25, 33] }))).toBe("bench_goalkeeper");
  });

  it("refuses a captain who does not start, or the same man as vice-captain", () => {
    expect(code(validFullAnswer({ captain_id: 25 }))).toBe("captain_not_starter");
    expect(code(validFullAnswer({ vice_captain_id: 15 }))).toBe("captain_not_starter");
    expect(code(validFullAnswer({ vice_captain_id: 42 }))).toBe("captain_vice_same");
  });

  it("wants one reason for each of the fifteen and the player sold, and plain sentences", () => {
    const answer = validFullAnswer();
    expect(code({ ...answer, reasons: answer.reasons.slice(1) })).toBe("reasons_incomplete");
    expect(code({ ...answer, reasons: [...answer.reasons, answer.reasons[0]] })).toBe("reasons_incomplete");
    expect(code({ ...answer, reasons: [...answer.reasons.slice(0, -1), { player_id: 999, reason: "Who?" }] })).toBe("reasons_incomplete");
    expect(code({ ...answer, reasons: answer.reasons.map((item, index) => (index === 0 ? { ...item, reason: "He scores 12 goals." } : item)) })).toBe(
      "digit_outside_placeholder"
    );
    expect(code({ ...answer, summary: "See https://example.com now." })).toBe("markup");
    expect(code({ ...answer, summary: "Try {p987654}." })).toBe("unknown_player");
    expect(code({ ...answer, summary: "" })).toBe("empty_text");
  });

  it("refuses an answer that is not the schema's shape", () => {
    expect(code({})).toBe("schema");
    expect(code({ ...validFullAnswer(), extra: 1 })).toBe("schema");
    expect(code(null)).toBe("schema");
  });
});

describe("the reservation of a full-AI call", () => {
  it("is its own, larger amount (a ceiling of 36,000 input tokens and 20,000 output tokens)", () => {
    expect(FULL_INPUT_TOKEN_CEILING).toBe(36_000);
    expect(FULL_MAX_TOKENS).toBe(20_000);
    expect(maxCostFullCallUsd()).toBe(1.088);
    expect(maxCostFullCallUsd()).toBeGreaterThan(maxCostPerCallUsd());
  });

  it("is built from the same data as the ranking mode plus the selling prices and the chips", () => {
    const user = JSON.parse(full.user) as { S: { sell: number[][]; chips: { wildcard: number; freehit: number } }; M: unknown; P: unknown };
    expect(user.S.sell).toHaveLength(15);
    expect(user.S.sell[0]).toEqual([1, 5]);
    expect(user.S.chips).toEqual({ wildcard: 0, freehit: 0 });
    expect(user.M).toBeDefined();
    // Names never reach the model.
    expect(full.user).not.toContain("Zorro");
    expect(full.system).toContain("Never write a player's name");
  });
});

const askFull = (deps: Parameters<typeof requestFullAi>[1], regenerate = false, entryId = TEAM) => requestFullAi({ entryId, locale: "ko", regenerate }, deps);
const settle = (jobs: Array<Promise<void>>) => Promise.all(jobs);
const goodFull = () => okResponse(answerText(validFullAnswer()), { input: 15_000, output: 4_000 });
const brokenFull = () => okResponse(answerText(validFullAnswer({ captain_id: 25 })));

describe("the full-AI flow", () => {
  it("is off, or closed to other teams, like the ranking mode, and touches nothing", async () => {
    const client = new FakeClient([]);
    const store = new FakeStore();
    const off = makeDeps({ input: ranking, fullInput: full, client, store, config: DISABLED });
    expect(await askFull(off.deps)).toEqual({ status: "disabled" });
    expect(await readFullAi(TEAM, "ko", off.deps)).toEqual({ status: "disabled" });
    const other = makeDeps({ input: ranking, fullInput: full, client, store });
    expect(await askFull(other.deps, false, 123456)).toEqual({ status: "not_allowed" });
    expect(other.loadFullInput).not.toHaveBeenCalled();
    expect(client.calls).toBe(0);
    expect(store.startCalls).toBe(0);
  });

  it("reserves the full amount, calls once with its own schema and cap, and stores the checked plan", async () => {
    const client = new FakeClient([goodFull()]);
    const store = new FakeStore();
    const { deps, jobs } = makeDeps({ input: ranking, fullInput: full, client, store });

    expect(await askFull(deps)).toEqual({ status: "pending" });
    expect(store.usage[0].reserved).toBe(maxCostFullCallUsd());
    await settle(jobs);
    expect(client.calls).toBe(1);
    const request = client.requests[0] as { system: string; schema?: unknown; maxTokens?: number };
    expect(request.maxTokens).toBe(FULL_MAX_TOKENS);
    expect(request.schema).toMatchObject({ required: expect.arrayContaining(["starters", "bench", "captain_id", "transfers"]) });
    // 15,000 in + 4,000 out = $0.12 + $0.16
    expect(store.usage[0]).toMatchObject({ status: "settled" });
    expect(store.usage[0].cost).toBeCloseTo(0.28, 6);

    const out = await readFullAi(TEAM, "ko", deps);
    expect(out.status).toBe("done");
    if (out.status !== "done") return;
    expect(out.value).toMatchObject({ generation: 1, kind: "first", modelId: "claude-fable-5-2" });
    expect(out.value.result).toMatchObject({ mode: "full", verified: true, failureCode: null, chip: "none" });
    expect(out.value.result.transfers).toEqual([{ out: 21, in: 42 }]);
    // The rules engine's best option and the AI's own figures, side by side.
    expect(out.value.result.money).toEqual({ transferCost: 0, freeTransfers: 1, bankAfter: 0 });
    expect(out.value.result.rules.scenarioId).toBe(payload.transfers!.recommendedId);
    // Cards of the new fifteen and of the player sold.
    expect(Object.keys(out.value.result.cards).sort()).toEqual(["1", "11", "12", "13", "14", "15", "2", "21", "22", "23", "24", "25", "31", "32", "33", "42"].sort());
  });

  it("reuses a stored answer for free, also when asked again about an input that has not changed", async () => {
    const client = new FakeClient([goodFull()]);
    const store = new FakeStore();
    const { deps, jobs } = makeDeps({ input: ranking, fullInput: full, client, store });
    await askFull(deps);
    await settle(jobs);

    const again = await askFull(deps);
    expect(again.status).toBe("done");
    const regen = await askFull(deps, true);
    expect(regen.status).toBe("done");
    expect(client.calls).toBe(1);
    expect(store.startCalls).toBe(1);
    expect(store.usage).toHaveLength(1);
  });

  it("asks again when the input changed, as a manual run", async () => {
    const client = new FakeClient([goodFull(), goodFull()]);
    const store = new FakeStore();
    const first = makeDeps({ input: ranking, fullInput: full, client, store });
    await askFull(first.deps);
    await settle(first.jobs);
    const changed: FullInput = { ...full, inputHash: "another-hash", basis: { ...full.basis, inputHash: "another-hash" } };
    const second = makeDeps({ input: ranking, fullInput: changed, client, store });
    expect(await askFull(second.deps, true)).toEqual({ status: "pending", previous: expect.objectContaining({ generation: 1 }) });
    await settle(second.jobs);
    expect(client.calls).toBe(2);
    const out = await readFullAi(TEAM, "ko", second.deps);
    expect(out.status === "done" && out.value).toMatchObject({ generation: 2, kind: "manual" });
  });

  it("asks once more after a wrong answer, reserving again, and stores the second answer", async () => {
    const client = new FakeClient([brokenFull(), goodFull()]);
    const store = new FakeStore();
    const { deps, jobs } = makeDeps({ input: ranking, fullInput: full, client, store });
    await askFull(deps);
    await settle(jobs);
    expect(client.calls).toBe(2);
    expect(store.usage.map((row) => row.reserved)).toEqual([maxCostFullCallUsd(), maxCostFullCallUsd()]);
    const out = await readFullAi(TEAM, "ko", deps);
    expect(out.status === "done" && out.value.result.verified).toBe(true);
  });

  it("falls back to the rules engine's best option, marked as not verified, when two answers break a rule", async () => {
    const client = new FakeClient([brokenFull(), brokenFull()]);
    const store = new FakeStore();
    const { deps, jobs } = makeDeps({ input: ranking, fullInput: full, client, store });
    await askFull(deps);
    await settle(jobs);
    expect(client.calls).toBe(2);
    const out = await readFullAi(TEAM, "ko", deps);
    expect(out.status).toBe("done");
    if (out.status !== "done") return;
    const result = out.value.result;
    expect(result).toMatchObject({ mode: "full", verified: false, failureCode: "captain_not_starter", reasons: [], money: null, summary: "" });
    expect(result.fallbackScenarioId).toBe(payload.transfers!.recommendedId);
    expect(result.lineup.starters).toEqual(payload.lineups[0].starters);
    // The AI's wrong picks are not in what is stored.
    expect(JSON.stringify(result)).not.toContain("captain_id");
  });

  it("does not retry or fall back when the call itself failed or was cut short", async () => {
    const store = new FakeStore();
    const cut = makeDeps({
      input: ranking,
      fullInput: full,
      store,
      client: new FakeClient([{ stopReason: "max_tokens", text: "{", usage: { input: 10, output: 20_000, cacheRead: 0, cacheWrite: 0 } }])
    });
    await askFull(cut.deps);
    await settle(cut.jobs);
    expect(await readFullAi(TEAM, "ko", cut.deps)).toEqual({ status: "failed", code: "truncated" });
  });

  it("shows a limit instead of calling when the month's cap would be passed (the box is then switched off on screen)", async () => {
    const client = new FakeClient([]);
    const store = new FakeStore();
    store.refuse = "month_limit";
    const { deps } = makeDeps({ input: ranking, fullInput: full, client, store });
    expect(await askFull(deps)).toEqual({ status: "limit", reason: "month" });
    expect(client.calls).toBe(0);
  });

  it("uses the same daily and monthly caps: a day with $5 spent leaves no room for another full call", async () => {
    const client = new FakeClient([]);
    const store = new FakeStore();
    store.usage.push({ id: "u0", jobId: "j0", reserved: 4.5, cost: 4.5, status: "settled", created: Date.parse("2026-11-22T12:00:00Z") });
    const { deps } = makeDeps({ input: ranking, fullInput: full, client, store });
    // 4.5 + 1.088 > 5
    expect(await askFull(deps)).toEqual({ status: "limit", reason: "day" });
    expect(client.calls).toBe(0);
  });

  it("answers failed for a team without a full squad, and for a deployment without the mode", async () => {
    const none = makeDeps({ input: ranking, fullInput: full });
    none.loadFullInput.mockRejectedValueOnce(new FullUnavailableError("no_squad"));
    expect(await askFull(none.deps)).toEqual({ status: "failed", code: "no_squad" });
    expect(none.deps.store && (none.deps.store as FakeStore).startCalls).toBe(0);
    const without = makeDeps({ input: ranking });
    expect(await askFull(without.deps)).toEqual({ status: "failed", code: "full_unsupported" });
  });

  it("keeps the two modes apart: a full answer is not the ranking answer, and each runs as a manual run after the other", async () => {
    const client = new FakeClient([okResponse(answerText(validAnswer(ranking))), goodFull()]);
    const store = new FakeStore();
    const { deps, jobs } = makeDeps({ input: ranking, fullInput: full, client, store });

    // The ranking answer first.
    const { requestEntryAi } = await import("@/lib/ai/recommend");
    await requestEntryAi({ entryId: TEAM, locale: "ko", regenerate: false }, deps);
    await settle(jobs.splice(0));
    expect((await readEntryAi(TEAM, "ko", deps)).status).toBe("done");
    // The full mode has nothing yet.
    expect(await readFullAi(TEAM, "ko", deps)).toEqual({ status: "none" });

    // The full answer: a manual run (the database allows one "first" per key).
    await askFull(deps);
    await settle(jobs.splice(0));
    const fullOut = await readFullAi(TEAM, "ko", deps);
    expect(fullOut.status === "done" && fullOut.value).toMatchObject({ kind: "manual", generation: 2 });
    // The ranking read still gives the ranking answer, not the full one.
    const rankOut = await readEntryAi(TEAM, "ko", deps);
    expect(rankOut.status === "done" && rankOut.value.result).toHaveProperty("lineup.option_id");
  });
});
