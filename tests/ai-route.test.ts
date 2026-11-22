import { NextRequest } from "next/server";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { AiDeps } from "@/lib/ai/recommend";
import type { AiInput } from "@/lib/ai/input-bundle";
import { resetEntryRequestLimits } from "@/lib/entry-request-limit";
import { EntryBusyError, EntryNotFoundError, FplUnavailableError } from "@/lib/entry-squad";
import { DISABLED, FakeClient, FakeStore, TEAM, answerText, deferred, makeAiInput, makeDeps, okResponse, validAnswer } from "./helpers/ai";

const state = vi.hoisted(() => ({ deps: null as unknown as AiDeps }));
vi.mock("@/lib/ai/runtime", () => ({ getAiDeps: () => state.deps }));
// Issue #47: these tests are about what the route computes, not who may ask. The own-team guard has its own tests
// (tests/own-team-guard.test.ts), so here it lets the request through.
vi.mock("@/lib/journal/own-team", async (importActual) => ({
  ...(await importActual<typeof import("@/lib/journal/own-team")>()),
  checkOwnTeam: async () => "ok"
}));

import { GET, POST } from "@/app/api/entry-ai/route";

// Issue #43 stages 2-3: the route answers statuses, never an error, for "rules-based result only".
let input: AiInput;
beforeAll(async () => {
  input = (await makeAiInput()).input;
});
beforeEach(() => {
  resetEntryRequestLimits();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => vi.restoreAllMocks());

const post = (body: unknown, ip = "9.9.9.9") =>
  new NextRequest("http://localhost/api/entry-ai", {
    method: "POST",
    headers: { "x-forwarded-for": ip, "content-type": "application/json", "sec-fetch-site": "same-origin" },
    body: typeof body === "string" ? body : JSON.stringify(body)
  });
const get = (query: string) => new NextRequest(`http://localhost/api/entry-ai${query}`);
const good = () => okResponse(answerText(validAnswer(input)));

function use(args: Parameters<typeof makeDeps>[0]) {
  const made = makeDeps(args);
  state.deps = made.deps;
  return made;
}

describe("request checks", () => {
  it("answers 400 for a bad body, entry ID, locale or regenerate flag, without any work", async () => {
    const { loadInput } = use({ input });
    expect((await POST(post("not json"))).status).toBe(400);
    expect((await POST(post("null"))).status).toBe(400);
    expect((await POST(post({ locale: "ko" }))).status).toBe(400);
    expect((await POST(post({ entryId: "abc", locale: "ko" }))).status).toBe(400);
    expect((await POST(post({ entryId: -1, locale: "ko" }))).status).toBe(400);
    expect((await POST(post({ entryId: TEAM, locale: "fr" }))).status).toBe(400);
    expect((await POST(post({ entryId: TEAM }))).status).toBe(400);
    expect((await POST(post({ entryId: TEAM, locale: "ko", regenerate: "yes" }))).status).toBe(400);
    expect((await GET(get(""))).status).toBe(400);
    expect((await GET(get(`?entryId=${TEAM}`))).status).toBe(400);
    expect((await GET(get(`?entryId=${TEAM}&locale=de`))).status).toBe(400);
    expect(loadInput).not.toHaveBeenCalled();
  });
});

describe("rules-based only is a status, not an error", () => {
  it("off: 200 disabled, no work, no per-IP quota used", async () => {
    const client = new FakeClient([]);
    const { loadInput } = use({ input, config: DISABLED, store: null, client: null });
    for (let i = 0; i < 30; i += 1) {
      const response = await POST(post({ entryId: TEAM, locale: "ko" }));
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ status: "disabled" });
    }
    const status = await GET(get(`?entryId=${TEAM}&locale=ko`));
    expect(await status.json()).toEqual({ status: "disabled" });
    expect(loadInput).not.toHaveBeenCalled();
    expect(client.calls).toBe(0);
  });

  it("a team outside the allow list: 200 not_allowed", async () => {
    const { loadInput } = use({ input });
    const response = await POST(post({ entryId: 5, locale: "ko" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "not_allowed" });
    expect(await (await GET(get("?entryId=5&locale=ko"))).json()).toEqual({ status: "not_allowed" });
    expect(loadInput).not.toHaveBeenCalled();
  });

  it("a reached cap: 200 limit with the reason", async () => {
    const store = new FakeStore();
    store.refuse = "month_limit";
    const client = new FakeClient([]);
    use({ input, store, client });
    const response = await POST(post({ entryId: TEAM, locale: "ko" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "limit", reason: "month", previous: null });
    expect(client.calls).toBe(0);
  });

  it("a store that cannot be reached: 200 failed, no call", async () => {
    const store = new FakeStore();
    store.failOn = "start";
    const client = new FakeClient([]);
    use({ input, store, client });
    const response = await POST(post({ entryId: TEAM, locale: "ko" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "failed", code: "store_unavailable" });
    expect(client.calls).toBe(0);
  });
});

describe("a running and a finished analysis", () => {
  it("POST answers 202 while the job runs, GET answers 202 too, then 200 done with the stored copy", async () => {
    const slow = deferred();
    const client = new FakeClient([slow.promise]);
    const { jobs } = use({ input, client });

    const started = await POST(post({ entryId: TEAM, locale: "ko" }));
    expect(started.status).toBe(202);
    expect(await started.json()).toEqual({ status: "pending", previous: null });
    expect((await GET(get(`?entryId=${TEAM}&locale=ko`))).status).toBe(202);
    expect((await POST(post({ entryId: TEAM, locale: "ko" }))).status).toBe(202);
    expect(client.calls).toBe(1);

    slow.resolve(good());
    await Promise.all(jobs);
    const done = await GET(get(`?entryId=${TEAM}&locale=ko`));
    expect(done.status).toBe(200);
    expect(done.headers.get("cache-control")).toBe("no-store");
    const body = await done.json();
    expect(body).toMatchObject({ status: "done", generation: 1, modelId: "claude-fable-5-2", modelVersion: "xp1" });
    expect(body.result.captain[0].player_id).toBe(input.context.captainIds[0]);
    // A later POST returns the stored copy for free.
    expect((await POST(post({ entryId: TEAM, locale: "ko" }))).status).toBe(200);
    expect(client.calls).toBe(1);
  });

  it("GET before anything was asked answers none and starts nothing", async () => {
    const client = new FakeClient([]);
    const store = new FakeStore();
    use({ input, client, store });
    expect(await (await GET(get(`?entryId=${TEAM}&locale=en`))).json()).toEqual({ status: "none", budgetNotice: null });
    expect(store.startCalls).toBe(0);
    expect(client.calls).toBe(0);
  });

  it("never puts a prompt, a token count, a cost or an SDK message in a response", async () => {
    const client = new FakeClient([okResponse(answerText(validAnswer(input)), { input: 12_345, output: 6_789 })]);
    const { jobs } = use({ input, client });
    const bodies = [await (await POST(post({ entryId: TEAM, locale: "ko" }))).text()];
    await Promise.all(jobs);
    bodies.push(await (await GET(get(`?entryId=${TEAM}&locale=ko`))).text());
    bodies.push(await (await POST(post({ entryId: TEAM, locale: "ko", regenerate: true }))).text());
    const all = bodies.join("\n");
    for (const leak of ["12345", "6789", "usage", "token", "cost_usd", "costUsd", "reserved", input.system.slice(0, 40), "test-key", "input_hash", "inputHash", input.user.slice(0, 30)]) {
      expect(all).not.toContain(leak);
    }
  });

  it("a failed job answers 200 failed with the code", async () => {
    const client = new FakeClient([{ ...good(), stopReason: "refusal" }]);
    const { jobs } = use({ input, client });
    await POST(post({ entryId: TEAM, locale: "ko" }));
    await Promise.all(jobs);
    expect(await (await GET(get(`?entryId=${TEAM}&locale=ko`))).json()).toEqual({ status: "failed", code: "refusal", budgetNotice: null });
  });
});

describe("existing brakes", () => {
  it("the per-IP brake still applies to POST (429 with Retry-After) once the team is allowed and the layer is on", async () => {
    use({ input, client: new FakeClient([good()]) });
    let last = 0;
    for (let i = 0; i < 21; i += 1) {
      const response = await POST(post({ entryId: TEAM, locale: "ko" }, "5.5.5.5"));
      last = response.status;
      if (response.status === 429) {
        expect(response.headers.get("retry-after")).toBeTruthy();
      }
    }
    expect(last).toBe(429);
    // Another address is unaffected.
    expect((await POST(post({ entryId: TEAM, locale: "ko" }, "6.6.6.6"))).status).not.toBe(429);
  });

  it("a forced regenerate is held to one per 30 seconds per IP", async () => {
    use({ input, client: new FakeClient([good(), good()]) });
    await POST(post({ entryId: TEAM, locale: "ko" }, "7.7.7.7"));
    const first = await POST(post({ entryId: TEAM, locale: "ko", regenerate: true }, "7.7.7.7"));
    const second = await POST(post({ entryId: TEAM, locale: "ko", regenerate: true }, "7.7.7.7"));
    expect(first.status).not.toBe(429);
    expect(second.status).toBe(429);
  });
});

describe("upstream errors", () => {
  it("maps team-not-found, busy and FPL-down like /api/entry-recommend, and hides anything else", async () => {
    const cases: Array<[Error, number]> = [
      [new EntryNotFoundError(), 404],
      [new EntryBusyError(2), 503],
      [new FplUnavailableError(), 502],
      [new Error("sk-ant-secret in message"), 500]
    ];
    for (const [error, status] of cases) {
      const made = use({ input });
      made.loadInput.mockRejectedValueOnce(error);
      const response = await POST(post({ entryId: TEAM, locale: "ko" }, `8.8.8.${status % 200}`));
      expect(response.status).toBe(status);
      expect(await response.text()).not.toContain("sk-ant");
    }
  });
});
