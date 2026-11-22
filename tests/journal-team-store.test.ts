import { afterEach, describe, expect, it, vi } from "vitest";
import { createSupabaseStore } from "@/lib/journal/supabase-store";

// Issue #47: the Supabase side of the team change: the rpc call, its answers, and the extra profile column.
const store = createSupabaseStore({ url: "https://example.supabase.test", anonKey: "anon-test", serviceKey: "service-test" });
const reply = (status: number, body: unknown) => vi.fn(async (..._args: unknown[]) => new Response(JSON.stringify(body), { status }));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("changeTeam", () => {
  it("calls the database function with the service key and maps its answers", async () => {
    const fetchMock = reply(200, { ok: true });
    vi.stubGlobal("fetch", fetchMock);
    expect(await store.changeTeam("u1", 9, 30)).toEqual({ code: "ok" });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://example.supabase.test/rest/v1/rpc/journal_change_team");
    expect(JSON.parse(String(init.body))).toEqual({ p_user: "u1", p_team: 9, p_cooldown_days: 30 });
    expect((init.headers as Record<string, string>).apikey).toBe("service-test");

    vi.stubGlobal("fetch", reply(200, { ok: false, reason: "same_team" }));
    expect(await store.changeTeam("u1", 9, 30)).toEqual({ code: "same_team" });
    vi.stubGlobal("fetch", reply(200, { ok: false, reason: "team_taken" }));
    expect(await store.changeTeam("u1", 9, 30)).toEqual({ code: "team_taken" });
    vi.stubGlobal("fetch", reply(200, { ok: false, reason: "too_soon", next_change_at: "2026-12-01T00:00:00+00:00" }));
    expect(await store.changeTeam("u1", 9, 30)).toEqual({ code: "too_soon", nextChangeAt: "2026-12-01T00:00:00.000Z" });
  });

  it("treats a failed call or an unknown answer as an error, never as success", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", reply(404, { message: "function not found" }));
    expect(await store.changeTeam("u1", 9, 30)).toEqual({ code: "error" });
    vi.stubGlobal("fetch", reply(200, { ok: false, reason: "something_new" }));
    expect(await store.changeTeam("u1", 9, 30)).toEqual({ code: "error" });
    vi.stubGlobal("fetch", reply(200, null));
    expect(await store.changeTeam("u1", 9, 30)).toEqual({ code: "error" });
  });
});

describe("getProfile", () => {
  it("returns the time of the last team change, null when never changed, and null without a profile", async () => {
    vi.stubGlobal("fetch", reply(200, [{ fpl_team_id: 7, team_changed_at: "2026-11-01T00:00:00+00:00" }]));
    expect(await store.getProfile("u1")).toEqual({ teamId: 7, teamChangedAt: "2026-11-01T00:00:00+00:00" });
    vi.stubGlobal("fetch", reply(200, [{ fpl_team_id: 7, team_changed_at: null }]));
    expect(await store.getProfile("u1")).toEqual({ teamId: 7, teamChangedAt: null });
    vi.stubGlobal("fetch", reply(200, []));
    expect(await store.getProfile("u1")).toBeNull();
  });
});
