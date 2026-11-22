import { NextRequest } from "next/server";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { AiDeps } from "@/lib/ai/recommend";
import type { AiInput } from "@/lib/ai/input-bundle";
import { resetEntryRequestLimits } from "@/lib/entry-request-limit";
import type { EntryRecommendPayload } from "@/lib/xp/recommend";
import { FakeClient, TEAM, answerText, makeAiInput, makeDeps, okResponse, validAnswer } from "./helpers/ai";

// Issue #47: the three personal-analysis APIs answer only for the team registered on the signed-in member's account.
// The guard is the real one; only the member store is a fake (a token -> user map and one profile per user).
const state = vi.hoisted(() => ({
  deps: null as unknown as AiDeps,
  profiles: new Map<string, { teamId: number; teamChangedAt: string | null }>(),
  storeDown: false,
  storeConfigured: true,
  recommendCalls: [] as number[],
  logCalls: [] as number[]
}));

vi.mock("@/lib/journal/session", async (importActual) => ({
  ...(await importActual<typeof import("@/lib/journal/session")>()),
  requireStore: () =>
    state.storeConfigured
      ? {
          getUser: async (token: string) => {
            if (state.storeDown) throw new Error("down");
            return token === "owner" ? { id: "u-owner", email: "o@b.co" } : token === "other" ? { id: "u-other", email: "x@b.co" } : token === "empty" ? { id: "u-empty", email: "e@b.co" } : null;
          },
          getProfile: async (userId: string) => state.profiles.get(userId) ?? null
        }
      : null
}));
vi.mock("@/lib/ai/runtime", () => ({ getAiDeps: () => state.deps }));
vi.mock("@/lib/ai/log-runtime", () => ({
  recordInBackground: () => undefined,
  loadRecommendationLog: async (entryId: number) => {
    state.logCalls.push(entryId);
    return [];
  }
}));
vi.mock("@/lib/xp/recommend", async (importActual) => ({
  ...(await importActual<typeof import("@/lib/xp/recommend")>()),
  getEntryRecommend: vi.fn(async (entryId: number) => {
    state.recommendCalls.push(entryId);
    return { entryId } as unknown as EntryRecommendPayload;
  })
}));

import { GET as getAi, POST as postAi } from "@/app/api/entry-ai/route";
import { GET as getLog } from "@/app/api/entry-recommend-log/route";
import { GET as getRecommend } from "@/app/api/entry-recommend/route";
import { checkOwnTeam } from "@/lib/journal/own-team";
import { SESSION_COOKIE } from "@/lib/journal/session";

let input: AiInput;
beforeAll(async () => {
  input = (await makeAiInput()).input;
});
beforeEach(() => {
  resetEntryRequestLimits();
  state.profiles = new Map([
    ["u-owner", { teamId: TEAM, teamChangedAt: null }],
    ["u-other", { teamId: 777, teamChangedAt: null }]
  ]);
  state.storeDown = false;
  state.storeConfigured = true;
  state.recommendCalls = [];
  state.logCalls = [];
  state.deps = makeDeps({ input }).deps;
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => vi.restoreAllMocks());

const cookie = (token?: string): Record<string, string> => (token ? { cookie: `${SESSION_COOKIE}=${token}` } : {});
const get = (path: string, token?: string) => new NextRequest(`http://localhost${path}`, { headers: { "x-forwarded-for": "9.9.9.9", ...cookie(token) } });
const post = (body: unknown, token?: string, site = "same-origin") =>
  new NextRequest("http://localhost/api/entry-ai", {
    method: "POST",
    headers: { "x-forwarded-for": "9.9.9.9", "content-type": "application/json", "sec-fetch-site": site, ...cookie(token) },
    body: JSON.stringify(body)
  });

describe("GET /api/entry-recommend", () => {
  it("answers 401 without a session and 403 for a team that is not the member's own, before any work", async () => {
    const anonymous = await getRecommend(get(`/api/entry-recommend?entryId=${TEAM}`));
    expect(anonymous.status).toBe(401);
    expect(await anonymous.json()).toEqual({ error: "login_required" });
    expect((await getRecommend(get(`/api/entry-recommend?entryId=${TEAM}`, "stale-token"))).status).toBe(401);

    const other = await getRecommend(get(`/api/entry-recommend?entryId=${TEAM}`, "other"));
    expect(other.status).toBe(403);
    expect(await other.json()).toEqual({ error: "not_your_team" });
    // A member with no registered team has no own team either.
    expect((await getRecommend(get(`/api/entry-recommend?entryId=${TEAM}`, "empty"))).status).toBe(403);
    expect(state.recommendCalls).toEqual([]);
  });

  it("answers 200 for the member's own team, and 403 right after the member's team changed", async () => {
    const own = await getRecommend(get(`/api/entry-recommend?entryId=${TEAM}`, "owner"));
    expect(own.status).toBe(200);
    expect(state.recommendCalls).toEqual([TEAM]);

    state.profiles.set("u-owner", { teamId: 555, teamChangedAt: "2026-11-22T00:00:00.000Z" });
    expect((await getRecommend(get(`/api/entry-recommend?entryId=${TEAM}`, "owner"))).status).toBe(403);
  });

  it("does not use up the per-IP brake for a refused request", async () => {
    for (let i = 0; i < 30; i += 1) {
      expect((await getRecommend(get(`/api/entry-recommend?entryId=${TEAM}`))).status).toBe(401);
    }
    expect((await getRecommend(get(`/api/entry-recommend?entryId=${TEAM}`, "owner"))).status).toBe(200);
  });

  it("answers 503, not login_required, when the member store cannot be read", async () => {
    state.storeDown = true;
    expect((await getRecommend(get(`/api/entry-recommend?entryId=${TEAM}`, "owner"))).status).toBe(503);
    state.storeDown = false;
    state.storeConfigured = false;
    const response = await getRecommend(get(`/api/entry-recommend?entryId=${TEAM}`, "owner"));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "not_configured" });
  });
});

describe("GET /api/entry-recommend-log", () => {
  it("answers 401 / 403 before the allowed-team check, and the allowed team's own member gets the list", async () => {
    expect((await getLog(get(`/api/entry-recommend-log?entryId=${TEAM}`))).status).toBe(401);
    expect((await getLog(get(`/api/entry-recommend-log?entryId=${TEAM}`, "other"))).status).toBe(403);
    expect((await getLog(get("/api/entry-recommend-log?entryId=777"))).status).toBe(401);
    expect(state.logCalls).toEqual([]);

    const own = await getLog(get(`/api/entry-recommend-log?entryId=${TEAM}`, "owner"));
    expect(own.status).toBe(200);
    expect(await own.json()).toEqual({ entries: [] });
    expect(state.logCalls).toEqual([TEAM]);
  });

  it("gives a member's own team that is not the allowed team an empty list, with no database access", async () => {
    const response = await getLog(get("/api/entry-recommend-log?entryId=777", "other"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ entries: [] });
    expect(state.logCalls).toEqual([]);
  });
});

describe("GET and POST /api/entry-ai", () => {
  it("GET: 401 / 403 for the allowed team, 200 for its own member", async () => {
    const query = `/api/entry-ai?entryId=${TEAM}&locale=ko`;
    const anonymous = await getAi(get(query));
    expect(anonymous.status).toBe(401);
    expect(await anonymous.json()).toEqual({ error: "login_required" });
    expect((await getAi(get(query, "other"))).status).toBe(403);
    const own = await getAi(get(query, "owner"));
    expect(own.status).toBe(200);
    expect((await own.json()).status).toBe("none");
  });

  it("POST: 401 / 403 for the allowed team, and an analysis starts only for its own member", async () => {
    const client = new FakeClient([okResponse(answerText(validAnswer(input)))]);
    const made = makeDeps({ input, client });
    state.deps = made.deps;
    const body = { entryId: TEAM, locale: "ko" };

    expect((await postAi(post(body))).status).toBe(401);
    expect((await postAi(post(body, "other"))).status).toBe(403);
    expect(client.calls).toBe(0);

    const own = await postAi(post(body, "owner"));
    expect(own.status).toBe(202);
    await Promise.all(made.jobs);
    expect(client.calls).toBe(1);
  });

  it("POST: a cross-site request is refused even with the member's cookie, and nothing is read", async () => {
    const made = makeDeps({ input });
    state.deps = made.deps;
    const response = await postAi(post({ entryId: TEAM, locale: "ko" }, "owner", "cross-site"));
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "forbidden" });
    expect(made.loadInput).not.toHaveBeenCalled();
  });

  it("keeps the free answers first: a team that is not allowed is not_allowed (200) even without a login", async () => {
    const anonymousGet = await getAi(get("/api/entry-ai?entryId=777&locale=ko"));
    expect(anonymousGet.status).toBe(200);
    expect(await anonymousGet.json()).toEqual({ status: "not_allowed" });
    const anonymousPost = await postAi(post({ entryId: 777, locale: "ko" }));
    expect(anonymousPost.status).toBe(200);
    expect(await anonymousPost.json()).toEqual({ status: "not_allowed" });
  });
});

describe("checkOwnTeam", () => {
  it("names the four outcomes", async () => {
    const req = (token?: string) => get("/x", token);
    expect(await checkOwnTeam(req("owner"), TEAM)).toBe("ok");
    expect(await checkOwnTeam(req(), TEAM)).toBe("login_required");
    expect(await checkOwnTeam(req("other"), TEAM)).toBe("not_your_team");
    state.storeConfigured = false;
    expect(await checkOwnTeam(req("owner"), TEAM)).toBe("not_configured");
  });
});
