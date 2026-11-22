import { NextRequest } from "next/server";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { LogDeps } from "@/lib/ai/rec-log";
import { readRecommendationLog, recordRecommendation, resetRecordThrottle } from "@/lib/ai/rec-log";
import { resetEntryRequestLimits } from "@/lib/entry-request-limit";
import type { EntryRecommendPayload } from "@/lib/xp/recommend";
import { TEAM, makeAiInput } from "./helpers/ai";
import { DEADLINE, MemoryLogStore, makeLogDeps, mkSummary } from "./helpers/rec-log";

const state = vi.hoisted(() => ({ deps: null as unknown as LogDeps, recorded: [] as unknown[], payload: null as unknown as EntryRecommendPayload }));
vi.mock("@/lib/ai/log-runtime", () => ({
  recordInBackground: (payload: EntryRecommendPayload) => {
    state.recorded.push(payload);
    void recordRecommendation(payload, state.deps).catch(() => undefined);
  },
  loadRecommendationLog: (entryId: number) => readRecommendationLog(entryId, state.deps)
}));
// Issue #47: these tests are about what the route computes, not who may ask. The own-team guard has its own tests
// (tests/own-team-guard.test.ts), so here it lets the request through.
vi.mock("@/lib/journal/own-team", async (importActual) => ({
  ...(await importActual<typeof import("@/lib/journal/own-team")>()),
  checkOwnTeam: async () => "ok"
}));
vi.mock("@/lib/xp/recommend", async (importActual) => ({
  ...(await importActual<typeof import("@/lib/xp/recommend")>()),
  getEntryRecommend: vi.fn(async (entryId: number) => ({ ...state.payload, entryId }))
}));

import { GET as getLog } from "@/app/api/entry-recommend-log/route";
import { GET as getRecommend } from "@/app/api/entry-recommend/route";

// Issue #43 stage 5: the two routes around the log. The recommendation never waits for the log and never fails
// because of it; the log route answers an empty list (200) for anything it cannot show.
beforeAll(async () => {
  state.payload = (await makeAiInput()).payload;
});
beforeEach(() => {
  resetEntryRequestLimits();
  resetRecordThrottle();
  state.recorded = [];
  state.deps = makeLogDeps({ open: { gw: state.payload.targetGw, deadlineAt: DEADLINE } }).deps;
});
afterEach(() => vi.restoreAllMocks());

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const recommend = (query: string, ip = "9.9.9.9") => new NextRequest(`http://localhost/api/entry-recommend${query}`, { headers: { "x-forwarded-for": ip } });
const log = (query: string, ip = "9.9.9.9") => new NextRequest(`http://localhost/api/entry-recommend-log${query}`, { headers: { "x-forwarded-for": ip } });
const memory = () => state.deps.store as MemoryLogStore;

describe("GET /api/entry-recommend records the allowed team", () => {
  it("answers as before and writes the summary behind the response", async () => {
    const response = await getRecommend(recommend(`?entryId=${TEAM}`));
    expect(response.status).toBe(200);
    expect((await response.json()).entryId).toBe(TEAM);
    await settle();
    expect(memory().upserts).toBe(1);
  });

  it("does not wait for a write that never finishes, and a failing write does not change the answer", async () => {
    memory().hang = true;
    expect((await getRecommend(recommend(`?entryId=${TEAM}`))).status).toBe(200);

    resetRecordThrottle();
    memory().hang = false;
    memory().failOn = "upsert";
    expect((await getRecommend(recommend(`?entryId=${TEAM}`, "8.8.8.8"))).status).toBe(200);
  });

  it("does not even try for another team, and logs only the default 3-week horizon", async () => {
    expect((await getRecommend(recommend("?entryId=777"))).status).toBe(200);
    expect((await getRecommend(recommend(`?entryId=${TEAM}&horizon=5`))).status).toBe(200);
    await settle();
    expect(state.recorded).toHaveLength(0);
    expect(memory().calls).toBe(0);
  });
});

describe("GET /api/entry-recommend-log", () => {
  it("answers 400 for a missing or malformed team ID", async () => {
    for (const query of ["", "?entryId=abc", "?entryId=-1"]) {
      expect((await getLog(log(query))).status).toBe(400);
    }
  });

  it("answers an empty list (200) for a team that is not allowed, with no database access", async () => {
    const response = await getLog(log("?entryId=777"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ entries: [] });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(memory().calls).toBe(0);
  });

  it("lists the allowed team's recorded gameweeks, newest first, uncached", async () => {
    for (const gw of [10, 11, 12]) memory().put({ entryId: TEAM, targetGw: gw, rulesSummary: mkSummary({ targetGw: gw }) });
    const response = await getLog(log(`?entryId=${TEAM}`));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.json();
    expect(body.entries.map((entry: { targetGw: number }) => entry.targetGw)).toEqual([12, 11, 10]);
    expect(body.entries[0].summary.captains).toHaveLength(3);
    expect(body.entries[0].actual).toBeNull();
  });

  it("answers an empty list when there is no store or the read fails", async () => {
    state.deps = makeLogDeps({ store: null }).deps;
    expect(await (await getLog(log(`?entryId=${TEAM}`))).json()).toEqual({ entries: [] });
    const failing = makeLogDeps();
    failing.store!.failOn = "list";
    state.deps = failing.deps;
    const response = await getLog(log(`?entryId=${TEAM}`, "7.7.7.7"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ entries: [] });
  });

  it("uses the existing per-IP brake: 429 with Retry-After after 20 requests a minute", async () => {
    let last = 200;
    for (let i = 0; i < 25; i += 1) {
      const response = await getLog(log(`?entryId=${TEAM}`, "6.6.6.6"));
      last = response.status;
      if (last === 429) {
        expect(response.headers.get("retry-after")).toBeTruthy();
        break;
      }
    }
    expect(last).toBe(429);
  });
});
