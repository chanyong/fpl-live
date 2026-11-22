import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChangeTeamResult } from "@/lib/journal/types";

// Issue #47: GET /api/journal/me, GET /api/journal/team-lookup and POST /api/journal/team.
const DAY = 24 * 60 * 60 * 1000;
const state = vi.hoisted(() => ({
  profile: null as { teamId: number; teamChangedAt: string | null } | null,
  change: null as unknown as () => Promise<ChangeTeamResult>,
  configured: true,
  getEntry: null as unknown as (id: number) => Promise<unknown>
}));
const store = {
  getUser: vi.fn(async (token: string) => (token === "good" ? { id: "u1", email: "secret@b.co" } : null)),
  getProfile: vi.fn(async () => state.profile),
  changeTeam: vi.fn(async (..._args: unknown[]) => state.change())
};
vi.mock("@/lib/journal/session", async (importActual) => ({
  ...(await importActual<typeof import("@/lib/journal/session")>()),
  requireStore: () => (state.configured ? store : null)
}));
vi.mock("@/lib/fpl-client", async (importActual) => ({
  ...(await importActual<typeof import("@/lib/fpl-client")>()),
  getEntry: (id: number) => state.getEntry(id)
}));

import { GET as me } from "@/app/api/journal/me/route";
import { POST as team } from "@/app/api/journal/team/route";
import { GET as lookup } from "@/app/api/journal/team-lookup/route";
import { resetEntryRequestLimits } from "@/lib/entry-request-limit";
import { SESSION_COOKIE } from "@/lib/journal/session";
import { resetTeamLookupCache } from "@/lib/journal/team-lookup";

const entry = (name = "Pleiades", first = "Kim", last = "Lee") => ({ id: 1, summary_overall_points: 0, name, player_first_name: first, player_last_name: last, started_event: 1 });

const get = (path: string, token?: string, ip = "9.9.9.9") =>
  new NextRequest(`http://localhost${path}`, { headers: { "x-forwarded-for": ip, ...(token ? { cookie: `${SESSION_COOKIE}=${token}` } : {}) } });
const post = (body: unknown, token?: string, site = "same-origin") =>
  new NextRequest("http://localhost/api/journal/team", {
    method: "POST",
    headers: { "x-forwarded-for": "9.9.9.9", "content-type": "application/json", "sec-fetch-site": site, ...(token ? { cookie: `${SESSION_COOKIE}=${token}` } : {}) },
    body: JSON.stringify(body)
  });

beforeEach(() => {
  resetEntryRequestLimits();
  resetTeamLookupCache();
  state.profile = { teamId: 5, teamChangedAt: null };
  state.change = async () => ({ code: "ok" });
  state.configured = true;
  state.getEntry = async () => entry();
  store.changeTeam.mockClear();
});
afterEach(() => vi.restoreAllMocks());

describe("GET /api/journal/me", () => {
  it("answers { member: false } without a session, with a bad one, and when the store is not configured", async () => {
    for (const request of [get("/api/journal/me"), get("/api/journal/me", "bad")]) {
      const response = await me(request);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ member: false });
      expect(response.headers.get("cache-control")).toBe("private, no-store");
    }
    state.configured = false;
    expect(await (await me(get("/api/journal/me", "good"))).json()).toEqual({ member: false });
  });

  it("answers the registered team and when it may be changed again, and never the email", async () => {
    const response = await me(get("/api/journal/me", "good"));
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    const body = await response.json();
    expect(body).toEqual({ member: true, teamId: 5, nextTeamChangeAt: null });
    expect(JSON.stringify(body)).not.toContain("secret@b.co");

    const changedAt = new Date(Date.now() - 10 * DAY).toISOString();
    state.profile = { teamId: 6, teamChangedAt: changedAt };
    const waiting = await (await me(get("/api/journal/me", "good"))).json();
    expect(waiting.teamId).toBe(6);
    expect(Date.parse(waiting.nextTeamChangeAt)).toBe(Date.parse(changedAt) + 30 * DAY);

    state.profile = null;
    expect(await (await me(get("/api/journal/me", "good"))).json()).toEqual({ member: true, teamId: null, nextTeamChangeAt: null });
  });

  it("answers 502 when the member store cannot be read, not a visitor", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    store.getProfile.mockRejectedValueOnce(new Error("down"));
    expect((await me(get("/api/journal/me", "good"))).status).toBe(502);
  });
});

describe("GET /api/journal/team-lookup", () => {
  it("answers the team name and manager without a login", async () => {
    const response = await lookup(get("/api/journal/team-lookup?teamId=123"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ teamId: 123, teamName: "Pleiades", managerName: "Kim Lee" });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("answers 400 for a bad number, 404 team_not_found for FPL's 404 and 503 fpl_unavailable for anything else", async () => {
    for (const query of ["", "?teamId=abc", "?teamId=-1", "?teamId=1e3"]) {
      expect((await lookup(get(`/api/journal/team-lookup${query}`))).status).toBe(400);
    }
    state.getEntry = async () => {
      throw new Error("FPL request failed: /entry/9/ (404)");
    };
    const missing = await lookup(get("/api/journal/team-lookup?teamId=9"));
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ error: "team_not_found" });
    state.getEntry = async () => {
      throw new Error("FPL request failed: /entry/10/ (503)");
    };
    const down = await lookup(get("/api/journal/team-lookup?teamId=10"));
    expect(down.status).toBe(503);
    expect(await down.json()).toEqual({ error: "fpl_unavailable" });
  });

  it("asks FPL once for a repeated number (short cache) and is held by the per-IP brake of the entry APIs", async () => {
    const getEntry = vi.fn(async () => entry());
    state.getEntry = getEntry;
    await lookup(get("/api/journal/team-lookup?teamId=123"));
    await lookup(get("/api/journal/team-lookup?teamId=123"));
    expect(getEntry).toHaveBeenCalledTimes(1);

    let status = 200;
    for (let id = 1000; id < 1020 && status === 200; id += 1) {
      status = (await lookup(get(`/api/journal/team-lookup?teamId=${id}`, undefined, "5.5.5.5"))).status;
    }
    expect(status).toBe(429);
  });
});

describe("POST /api/journal/team", () => {
  it("needs the same origin and a login", async () => {
    expect((await team(post({ teamId: 9 }, "good", "cross-site"))).status).toBe(403);
    expect((await team(post({ teamId: 9 }))).status).toBe(401);
    expect((await team(post({ teamId: 9 }, "bad"))).status).toBe(401);
    expect(store.changeTeam).not.toHaveBeenCalled();
    state.configured = false;
    expect((await team(post({ teamId: 9 }, "good"))).status).toBe(503);
  });

  it("answers 400 for a bad body", async () => {
    for (const body of [{}, { teamId: "abc" }, { teamId: -1 }, { teamId: 1.5 }, null]) {
      expect((await team(post(body, "good"))).status).toBe(400);
    }
  });

  it("ok: changes the team", async () => {
    const response = await team(post({ teamId: 9 }, "good"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(store.changeTeam).toHaveBeenCalledWith("u1", 9, 30);
  });

  it("maps each refusal: same_team 400, team_taken 409, team_not_found 404, fpl_unavailable 503, too_soon 429 with the next time", async () => {
    state.profile = { teamId: 9, teamChangedAt: null };
    const same = await team(post({ teamId: 9 }, "good"));
    expect(same.status).toBe(400);
    expect(await same.json()).toEqual({ error: "same_team" });

    state.profile = { teamId: 5, teamChangedAt: null };
    state.change = async () => ({ code: "team_taken" });
    const taken = await team(post({ teamId: 9 }, "good"));
    expect(taken.status).toBe(409);
    expect(await taken.json()).toEqual({ error: "team_taken" });

    state.getEntry = async () => {
      throw new Error("FPL request failed: /entry/9/ (404)");
    };
    const missing = await team(post({ teamId: 8 }, "good"));
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ error: "team_not_found" });

    state.getEntry = async () => {
      throw new Error("FPL request failed: /entry/7/ (500)");
    };
    expect((await team(post({ teamId: 7 }, "good"))).status).toBe(503);

    const changedAt = new Date(Date.now() - 5 * DAY).toISOString();
    state.profile = { teamId: 5, teamChangedAt: changedAt };
    const soon = await team(post({ teamId: 6 }, "good"));
    expect(soon.status).toBe(429);
    expect(await soon.json()).toEqual({ error: "too_soon", nextTeamChangeAt: new Date(Date.parse(changedAt) + 30 * DAY).toISOString() });
  });

  it("answers 502 when the database function fails", async () => {
    state.change = async () => ({ code: "error" });
    const response = await team(post({ teamId: 9 }, "good"));
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "change_failed" });
  });
});
