import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AiCallError } from "@/lib/ai/anthropic-client";
import type { AiInput } from "@/lib/ai/input-bundle";
import { aiGate, readEntryAi, requestEntryAi } from "@/lib/ai/recommend";
import { DISABLED, ENABLED, FakeClient, deferred, FakeStore, NOW, RESERVATION, TEAM, answerText, makeAiInput, makeDeps, okResponse, validAnswer } from "./helpers/ai";

// Issue #43 stages 2-3: the flow around the paid call. Fakes only: no network, no database.
let input: AiInput;
beforeAll(async () => {
  input = (await makeAiInput()).input;
});
beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => vi.restoreAllMocks());

const ask = (deps: Parameters<typeof requestEntryAi>[1], regenerate = false, entryId = TEAM) =>
  requestEntryAi({ entryId, locale: "ko", regenerate }, deps);
const settle = (jobs: Array<Promise<void>>) => Promise.all(jobs);
const good = () => okResponse(answerText(validAnswer(input)));

describe("off or not allowed: the rules-based result only", () => {
  it("is off without a key, a flag or Supabase settings, and touches nothing", async () => {
    const client = new FakeClient([]);
    const store = new FakeStore();
    const { deps, loadInput } = makeDeps({ input, client, store, config: DISABLED });
    expect(await ask(deps)).toEqual({ status: "disabled" });
    expect(await readEntryAi(TEAM, "ko", deps)).toEqual({ status: "disabled" });
    expect(loadInput).not.toHaveBeenCalled();
    expect(client.calls).toBe(0);
    expect(store.startCalls).toBe(0);
  });

  it("is off when the store or the client was not built even if the config says on", async () => {
    expect(aiGate(TEAM, makeDeps({ input, store: null }).deps)).toEqual({ status: "disabled" });
    expect(aiGate(TEAM, makeDeps({ input, client: null }).deps)).toEqual({ status: "disabled" });
  });

  it("does not serve a team outside the allow list", async () => {
    const client = new FakeClient([]);
    const store = new FakeStore();
    const { deps, loadInput } = makeDeps({ input, client, store });
    expect(await ask(deps, false, 123456)).toEqual({ status: "not_allowed" });
    expect(await readEntryAi(123456, "ko", deps)).toEqual({ status: "not_allowed" });
    expect(loadInput).not.toHaveBeenCalled();
    expect(client.calls).toBe(0);
    expect(store.startCalls).toBe(0);
  });
});

describe("a first analysis", () => {
  it("answers pending at once, then stores the checked answer with names filled in and the real cost", async () => {
    const client = new FakeClient([good()]);
    const store = new FakeStore();
    const { deps, jobs } = makeDeps({ input, client, store });

    expect(await ask(deps)).toEqual({ status: "pending" });
    expect(jobs).toHaveLength(1);

    await settle(jobs);
    expect(client.calls).toBe(1);
    expect(store.usage).toHaveLength(1);
    // The reservation was the largest possible call; the real cost replaced it.
    expect(store.usage[0]).toMatchObject({ reserved: RESERVATION, status: "settled" });
    // 10,000 in + 8,000 out = $0.08 + $0.32
    expect(store.usage[0].cost).toBeCloseTo(0.4, 6);

    const out = await readEntryAi(TEAM, "ko", deps);
    expect(out.status).toBe("done");
    if (out.status !== "done") return;
    expect(out.value).toMatchObject({ targetGw: input.basis.targetGw, generation: 1, kind: "first", modelId: "claude-fable-5-2", modelVersion: "xp1" });
    expect(JSON.stringify(out.value.result)).toContain("Zorro");
    expect(JSON.stringify(out.value.result)).not.toContain("{p");
    expect((out.value.basis as { captains: unknown[] }).captains.length).toBeGreaterThan(0);
  });

  it("sends the system prompt and the bundle, nothing else", async () => {
    const client = new FakeClient([good()]);
    const { deps, jobs } = makeDeps({ input, client });
    await ask(deps);
    await settle(jobs);
    expect(client.requests[0]).toEqual({ system: input.system, user: input.user });
  });

  it("reuses the stored copy for free: no second call, no second reservation, no input rebuilt", async () => {
    const client = new FakeClient([good()]);
    const store = new FakeStore();
    const { deps, jobs, loadInput } = makeDeps({ input, client, store });
    await ask(deps);
    await settle(jobs);
    expect(loadInput).toHaveBeenCalledTimes(1);

    const again = await ask(deps);
    expect(again.status).toBe("done");
    expect(await ask(deps)).toEqual(again);
    expect(client.calls).toBe(1);
    expect(store.startCalls).toBe(1);
    expect(store.usage).toHaveLength(1);
    expect(loadInput).toHaveBeenCalledTimes(1);
  });

  it("a second request while the job runs gets pending and starts nothing", async () => {
    const slow = deferred();
    const client = new FakeClient([slow.promise]);
    const store = new FakeStore();
    const { deps, jobs } = makeDeps({ input, client, store });
    expect(await ask(deps)).toEqual({ status: "pending" });
    expect(await ask(deps)).toEqual({ status: "pending" });
    expect(await readEntryAi(TEAM, "ko", deps)).toEqual({ status: "pending" });
    expect(store.startCalls).toBe(1);
    expect(client.calls).toBe(1);
    slow.resolve(good());
    await settle(jobs);
    expect(client.calls).toBe(1);
    expect((await readEntryAi(TEAM, "ko", deps)).status).toBe("done");
  });

  it("two requests at the same moment still start one job (the database refuses the second as busy)", async () => {
    const slow = deferred();
    const client = new FakeClient([slow.promise]);
    const store = new FakeStore();
    const { deps, jobs } = makeDeps({ input, client, store });
    const [a, b] = await Promise.all([ask(deps), ask(deps)]);
    expect([a.status, b.status]).toEqual(["pending", "pending"]);
    expect(store.startCalls).toBe(2);
    expect(jobs).toHaveLength(1);
    slow.resolve(good());
    await settle(jobs);
    expect(client.calls).toBe(1);
    expect(store.usage).toHaveLength(1);
  });

  it("keeps languages apart: English is its own key and its own reservation", async () => {
    const client = new FakeClient([good(), good()]);
    const store = new FakeStore();
    const { deps, jobs } = makeDeps({ input, client, store });
    await ask(deps);
    await requestEntryAi({ entryId: TEAM, locale: "en", regenerate: false }, deps);
    await settle(jobs);
    expect(store.jobs.map((job) => job.key.locale).sort()).toEqual(["en", "ko"]);
    expect(client.calls).toBe(2);
  });
});

describe("limits", () => {
  it("answers limit and makes no call when the monthly cap is reached", async () => {
    const client = new FakeClient([]);
    const store = new FakeStore();
    store.refuse = "month_limit";
    const { deps, jobs } = makeDeps({ input, client, store });
    expect(await ask(deps)).toEqual({ status: "limit", reason: "month" });
    expect(jobs).toHaveLength(0);
    expect(client.calls).toBe(0);
    expect(store.jobs).toHaveLength(0);
  });

  it("answers limit for the daily cap and the daily call cap", async () => {
    for (const reason of ["day_limit", "day_calls_limit"] as const) {
      const client = new FakeClient([]);
      const store = new FakeStore();
      store.refuse = reason;
      const { deps } = makeDeps({ input, client, store });
      expect(await ask(deps)).toEqual({ status: "limit", reason: "day" });
      expect(client.calls).toBe(0);
    }
  });

  it("really adds up: spend near the monthly cap refuses the next reservation", async () => {
    const store = new FakeStore();
    store.usage.push({ id: "old", jobId: "x", reserved: 39.5, cost: 39.5, status: "settled", created: NOW });
    const client = new FakeClient([]);
    const { deps } = makeDeps({ input, client, store });
    expect(await ask(deps)).toEqual({ status: "limit", reason: "month" });
    expect(client.calls).toBe(0);
  });

  it("stops after five reservations in a day ($5 daily cap over $0.88 each)", async () => {
    const store = new FakeStore();
    const client = new FakeClient([]);
    const { deps } = makeDeps({ input, client, store });
    const statuses: string[] = [];
    for (let gw = 1; gw <= 6; gw += 1) {
      const gwInput = { ...input, basis: { ...input.basis, targetGw: gw } };
      const result = await requestEntryAi({ entryId: TEAM, locale: "ko", regenerate: false }, { ...deps, loadInput: async () => gwInput, targetGw: async () => gw });
      statuses.push(result.status === "limit" ? `limit:${result.reason}` : result.status);
    }
    expect(statuses).toEqual(["pending", "pending", "pending", "pending", "pending", "limit:day"]);
  });

  it("makes no call when the reservation cannot be written (fails closed)", async () => {
    for (const operation of ["start", "latest", "sweep"]) {
      const client = new FakeClient([]);
      const store = new FakeStore();
      store.failOn = operation;
      const { deps, jobs } = makeDeps({ input, client, store });
      expect(await ask(deps)).toEqual({ status: "failed", code: "store_unavailable" });
      expect(jobs).toHaveLength(0);
      expect(client.calls).toBe(0);
    }
  });

  it("does not send an input above the size ceiling", async () => {
    const huge = { ...input, user: "x".repeat(70_000) };
    const client = new FakeClient([]);
    const store = new FakeStore();
    const { deps } = makeDeps({ input: huge, client, store });
    expect(await ask(deps)).toEqual({ status: "failed", code: "input_too_large" });
    expect(store.startCalls).toBe(0);
    expect(client.calls).toBe(0);
  });
});

describe("analysing again", () => {
  const T = 25 * 3_600_000;

  async function withCopy(clockRef: { now: number }) {
    const client = new FakeClient([good(), good(), good(), good()]);
    const store = new FakeStore(() => clockRef.now);
    const { deps, jobs } = makeDeps({ input, client, store });
    await ask(deps);
    await settle(jobs.splice(0));
    return { client, store, deps, jobs };
  }

  it("a person-pressed regeneration runs once a day, then answers limit with the earlier copy", async () => {
    const clock = { now: NOW };
    const { client, store, deps, jobs } = await withCopy(clock);

    expect(await ask(deps, true)).toEqual({ status: "pending", previous: expect.objectContaining({ generation: 1 }) });
    await settle(jobs.splice(0));
    expect(store.jobs.map((job) => [job.generation, job.kind, job.status])).toEqual([
      [1, "first", "done"],
      [2, "manual", "done"]
    ]);
    expect(client.calls).toBe(2);

    const blocked = await ask(deps, true);
    expect(blocked).toMatchObject({ status: "limit", reason: "regen", previous: { generation: 2 } });
    expect(client.calls).toBe(2);
    // A plain request still gets the newest stored copy.
    expect(await ask(deps)).toMatchObject({ status: "done", value: { generation: 2 } });
  });

  it("never more than three generations per key, even on later days", async () => {
    const clock = { now: NOW };
    const { client, store, deps, jobs } = await withCopy(clock);
    for (let day = 0; day < 2; day += 1) {
      clock.now += T;
      expect(await ask(deps, true)).toMatchObject({ status: "pending" });
      await settle(jobs.splice(0));
    }
    expect(store.jobs.map((job) => job.generation)).toEqual([1, 2, 3]);
    clock.now += T;
    expect(await ask(deps, true)).toMatchObject({ status: "limit", reason: "regen" });
    expect(client.calls).toBe(3);
    expect(store.jobs).toHaveLength(3);
  });

  it("a failed generation counts toward the three and a retry without a stored copy is a first request again", async () => {
    const client = new FakeClient([new AiCallError("api_500"), new AiCallError("api_500"), new AiCallError("api_500"), good()]);
    const store = new FakeStore();
    const { deps, jobs } = makeDeps({ input, client, store });
    for (let i = 0; i < 3; i += 1) {
      expect(await ask(deps)).toEqual({ status: "pending" });
      await settle(jobs.splice(0));
    }
    expect(store.jobs.map((job) => job.kind)).toEqual(["first", "first", "first"]);
    expect(await ask(deps)).toEqual({ status: "limit", reason: "regen" });
    expect(client.calls).toBe(3);
  });
});

describe("what the call returns", () => {
  it("retries once after an invalid answer, reserves again, and counts both calls", async () => {
    const bad = okResponse(answerText(validAnswer(input, { summary: "It scores 5 points." })));
    const client = new FakeClient([bad, good()]);
    const store = new FakeStore();
    const { deps, jobs } = makeDeps({ input, client, store });
    await ask(deps);
    await settle(jobs);
    expect(client.calls).toBe(2);
    expect(store.usage).toHaveLength(2);
    expect(store.usage.map((row) => row.status)).toEqual(["settled", "settled"]);
    expect(store.usage.reduce((sum, row) => sum + row.cost, 0)).toBeCloseTo(0.8, 6);
    expect(store.jobs[0].status).toBe("done");
  });

  it("gives up after the one retry: two calls at most, failure code says why", async () => {
    const bad = () => okResponse(answerText(validAnswer(input, { lineup: { option_id: "L1", reason: "<b>x</b>" } })));
    const client = new FakeClient([bad(), bad(), good()]);
    const store = new FakeStore();
    const { deps, jobs } = makeDeps({ input, client, store });
    await ask(deps);
    await settle(jobs);
    expect(client.calls).toBe(2);
    expect(store.jobs[0]).toMatchObject({ status: "failed", failureCode: "invalid_output:markup", result: null });
    expect(store.usage).toHaveLength(2);
    expect(await readEntryAi(TEAM, "ko", deps)).toEqual({ status: "failed", code: "invalid_output:markup" });
  });

  it("treats text that is not JSON as an invalid answer", async () => {
    const client = new FakeClient([okResponse("I think you should captain someone."), okResponse("```json\n{}\n```")]);
    const store = new FakeStore();
    const { deps, jobs } = makeDeps({ input, client, store });
    await ask(deps);
    await settle(jobs);
    expect(store.jobs[0].failureCode).toBe("invalid_output:bad_json");
    expect(client.calls).toBe(2);
  });

  it("does not retry when the second reservation is refused: the job fails as limit and the first cost stays", async () => {
    const store = new FakeStore();
    const bad = okResponse(answerText(validAnswer(input, { summary: "Needs 3." })));
    const client = {
      calls: 0,
      async generate() {
        this.calls += 1;
        store.refuse = "day_limit";
        return bad;
      }
    };
    const { deps, jobs } = makeDeps({ input, client, store });
    await ask(deps);
    await settle(jobs);
    expect(client.calls).toBe(1);
    expect(store.jobs[0]).toMatchObject({ status: "failed", failureCode: "limit" });
    expect(store.usage).toHaveLength(1);
    expect(store.usage[0].cost).toBeCloseTo(0.4, 6);
  });

  it("a refusal is never read or retried, and its cost is counted", async () => {
    // The text would validate: it must still be ignored.
    const client = new FakeClient([{ ...good(), stopReason: "refusal", usage: { input: 9_000, output: 200, cacheRead: 0, cacheWrite: 0 } }, good()]);
    const store = new FakeStore();
    const { deps, jobs } = makeDeps({ input, client, store });
    await ask(deps);
    await settle(jobs);
    expect(client.calls).toBe(1);
    expect(store.jobs[0]).toMatchObject({ status: "failed", failureCode: "refusal", result: null });
    expect(store.usage[0]).toMatchObject({ status: "settled" });
    expect(store.usage[0].cost).toBeCloseTo(0.08, 6);
  });

  it("a truncated answer (max_tokens) is never read or retried, and the full cost is counted", async () => {
    const client = new FakeClient([{ ...good(), stopReason: "max_tokens", usage: { input: 12_000, output: 16_000, cacheRead: 0, cacheWrite: 0 } }, good()]);
    const store = new FakeStore();
    const { deps, jobs } = makeDeps({ input, client, store });
    await ask(deps);
    await settle(jobs);
    expect(client.calls).toBe(1);
    expect(store.jobs[0]).toMatchObject({ status: "failed", failureCode: "truncated", result: null });
    expect(store.usage[0].cost).toBeCloseTo(0.096 + 0.64, 6);
  });

  it("any other stop reason is a failure too", async () => {
    const client = new FakeClient([{ ...good(), stopReason: "pause_turn" }]);
    const store = new FakeStore();
    const { deps, jobs } = makeDeps({ input, client, store });
    await ask(deps);
    await settle(jobs);
    expect(store.jobs[0].failureCode).toBe("unexpected_stop");
  });

  it("an API error fails the job with a code only and keeps the reserved amount counted", async () => {
    const client = new FakeClient([new AiCallError("api_529"), good()]);
    const store = new FakeStore();
    const { deps, jobs } = makeDeps({ input, client, store });
    await ask(deps);
    await settle(jobs);
    expect(client.calls).toBe(1);
    expect(store.jobs[0]).toMatchObject({ status: "failed", failureCode: "api_529" });
    expect(store.usage[0]).toMatchObject({ status: "failed", cost: RESERVATION });
    const logged = vi.mocked(console.error).mock.calls.flat().join(" ");
    expect(logged).not.toContain("test-key");
    expect(logged).not.toContain(input.user.slice(0, 40));
  });

  it("an error that is not ours is reported as unknown, never with its message", async () => {
    const client = new FakeClient([new Error("secret details sk-ant-xyz")]);
    const store = new FakeStore();
    const { deps, jobs } = makeDeps({ input, client, store });
    await ask(deps);
    await settle(jobs);
    expect(store.jobs[0].failureCode).toBe("api_unknown");
    expect(JSON.stringify(store.jobs)).not.toContain("sk-ant");
    expect(vi.mocked(console.error).mock.calls.flat().join(" ")).not.toContain("sk-ant");
  });

  it("when the cost cannot be written the reservation simply stays counted and the answer is still kept", async () => {
    const client = new FakeClient([good()]);
    const store = new FakeStore();
    store.failOn = "settle";
    const { deps, jobs } = makeDeps({ input, client, store });
    await ask(deps);
    await settle(jobs);
    expect(store.jobs[0].status).toBe("done");
    expect(store.usage[0]).toMatchObject({ status: "reserved", cost: RESERVATION });
  });

  it("when storing the answer fails the job is closed as failed and nothing throws", async () => {
    const client = new FakeClient([good()]);
    const store = new FakeStore();
    store.failOn = "complete";
    const { deps, jobs } = makeDeps({ input, client, store });
    await ask(deps);
    await expect(settle(jobs)).resolves.toBeDefined();
    expect(store.jobs[0]).toMatchObject({ status: "failed", failureCode: "internal" });
  });
});

describe("reading the state", () => {
  it("is none before anything was asked, failed after a failure, pending with the earlier copy while a new one runs", async () => {
    const slow = deferred();
    const client = new FakeClient([good(), slow.promise]);
    const store = new FakeStore();
    const { deps, jobs } = makeDeps({ input, client, store });
    expect(await readEntryAi(TEAM, "ko", deps)).toEqual({ status: "none" });
    await ask(deps);
    await settle(jobs.splice(0));
    await ask(deps, true);
    expect(await readEntryAi(TEAM, "ko", deps)).toMatchObject({ status: "pending", previous: { generation: 1 } });
    slow.resolve(good());
    await settle(jobs.splice(0));
    expect(await readEntryAi(TEAM, "ko", deps)).toMatchObject({ status: "done", value: { generation: 2 } });
  });

  it("shows the older copy when a newer regeneration failed", async () => {
    const client = new FakeClient([good(), new AiCallError("api_500")]);
    const store = new FakeStore();
    const { deps, jobs } = makeDeps({ input, client, store });
    await ask(deps);
    await settle(jobs.splice(0));
    await ask(deps, true);
    await settle(jobs.splice(0));
    expect(await readEntryAi(TEAM, "ko", deps)).toMatchObject({ status: "done", value: { generation: 1 } });
  });

  it("closes a job that has been running for more than ten minutes as failed", async () => {
    const store = new FakeStore(() => NOW - 11 * 60_000);
    const client = new FakeClient([deferred().promise]);
    const { deps } = makeDeps({ input, client, store });
    expect(await ask(deps)).toEqual({ status: "pending" });
    expect(await readEntryAi(TEAM, "ko", deps)).toEqual({ status: "failed", code: "timeout" });
    // The reservation of the dead job stays counted.
    expect(store.usage[0]).toMatchObject({ status: "reserved", cost: RESERVATION });
  });

  it("does not close a job that has run for less than ten minutes", async () => {
    const store = new FakeStore(() => NOW - 9 * 60_000);
    const { deps } = makeDeps({ input, store, client: new FakeClient([deferred().promise]) });
    await ask(deps);
    expect(await readEntryAi(TEAM, "ko", deps)).toEqual({ status: "pending" });
  });

  it("answers failed (never a call) when the store cannot be read, and when the gameweek is unknown", async () => {
    const store = new FakeStore();
    store.failOn = "latest";
    expect(await readEntryAi(TEAM, "ko", makeDeps({ input, store }).deps)).toEqual({ status: "failed", code: "store_unavailable" });
    expect(await readEntryAi(TEAM, "ko", makeDeps({ input, targetGw: null }).deps)).toEqual({ status: "failed", code: "fpl_unavailable" });
  });

  it("the enabled fixture config is what the tests assume", () => {
    expect(ENABLED.enabled).toBe(true);
  });
});
