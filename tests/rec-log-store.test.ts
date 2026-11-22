import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { supabaseFromEnv } from "@/lib/ai/config";
import { LogStoreError, createSupabaseLogStore } from "@/lib/ai/log-store";
import { AiStoreError, createSupabaseAiStore } from "@/lib/ai/store";
import { mkSummary } from "./helpers/rec-log";

// Issue #43 stage 5: the REST calls of the log table (no migration: the table of 0002) and the month's usage read.
const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const lastCall = () => {
  const [url, init] = fetchMock.mock.calls.at(-1)!;
  return { url: String(url), init: init as RequestInit, body: init?.body ? JSON.parse(String(init.body)) : undefined };
};
const logStore = () => createSupabaseLogStore({ url: "https://db.example/", serviceKey: "svc-key" });

describe("supabaseFromEnv", () => {
  it("needs both settings and ignores the AI switch", () => {
    expect(supabaseFromEnv({ SUPABASE_URL: "https://x", SUPABASE_SERVICE_ROLE_KEY: "k" })).toEqual({ url: "https://x", serviceKey: "k" });
    expect(supabaseFromEnv({ SUPABASE_URL: "https://x" })).toBeNull();
    expect(supabaseFromEnv({})).toBeNull();
  });
});

describe("createSupabaseLogStore", () => {
  it("upserts on (entry_id, target_gw) sending only the summary columns, so a stored result is kept", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 201 }));
    await logStore().upsertSummary({ entryId: 4300767, targetGw: 12, modelVersion: "xp1", rulesSummary: mkSummary() });
    const call = lastCall();
    expect(call.url).toBe("https://db.example/rest/v1/ai_recommendation_log?on_conflict=entry_id,target_gw");
    expect(call.init.method).toBe("POST");
    expect((call.init.headers as Record<string, string>).Prefer).toContain("resolution=merge-duplicates");
    expect((call.init.headers as Record<string, string>).Authorization).toBe("Bearer svc-key");
    expect(Object.keys(call.body).sort()).toEqual(["entry_id", "model_version", "rules_summary", "target_gw", "updated_at"]);
  });

  it("lists the newest gameweeks of one team and maps the columns", async () => {
    fetchMock.mockResolvedValue(
      json([{ entry_id: 4300767, target_gw: 12, model_version: "xp1", rules_summary: { a: 1 }, actual_result: null, created_at: "c", updated_at: "u" }])
    );
    const rows = await logStore().listRecent(4300767, 10);
    expect(lastCall().url).toContain("entry_id=eq.4300767&order=target_gw.desc&limit=10");
    expect(rows).toEqual([{ entryId: 4300767, targetGw: 12, modelVersion: "xp1", rulesSummary: { a: 1 }, actualResult: null, createdAt: "c", updatedAt: "u" }]);
  });

  it("writes the result only where it is still null", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await logStore().setActual(4300767, 11, { v: 1, computedAt: "t", gw: 11, captains: [], captainTop: null, lineup: null, transfers: null, manager: null });
    const call = lastCall();
    expect(call.url).toContain("entry_id=eq.4300767&target_gw=eq.11&actual_result=is.null");
    expect(call.init.method).toBe("PATCH");
  });

  it("throws an error with the operation and status only, for an HTTP error, a network error and a malformed list", async () => {
    fetchMock.mockResolvedValueOnce(json({ message: "relation does not exist" }, 404));
    const error = await logStore().listRecent(1, 10).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(LogStoreError);
    expect(String((error as Error).message)).not.toContain("relation");
    fetchMock.mockRejectedValueOnce(new Error("socket"));
    await expect(logStore().listRecent(1, 10)).rejects.toMatchObject({ status: 0 });
    fetchMock.mockResolvedValueOnce(json({ not: "a list" }));
    await expect(logStore().listRecent(1, 10)).rejects.toBeInstanceOf(LogStoreError);
  });
});

describe("AiStore.monthUsageUsd", () => {
  const store = () => createSupabaseAiStore({ url: "https://db.example/", serviceKey: "svc-key" });

  it("sums this UTC month's usage rows (a read query, no new SQL function)", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-22T12:00:00Z"));
    fetchMock.mockResolvedValue(json([{ cost_usd: 0.4 }, { cost_usd: "0.96" }, { cost_usd: 30 }]));
    expect(await store().monthUsageUsd()).toBeCloseTo(31.36, 6);
    const call = lastCall();
    expect(call.url).toContain("/rest/v1/ai_usage?select=cost_usd&created_at=gte.2026-11-01T00%3A00%3A00.000Z");
    expect(call.init.method ?? "GET").toBe("GET");
    vi.useRealTimers();
  });

  it("fails closed in the caller's eyes: an HTTP error or a malformed body throws", async () => {
    fetchMock.mockResolvedValueOnce(json({}, 500));
    await expect(store().monthUsageUsd()).rejects.toBeInstanceOf(AiStoreError);
    fetchMock.mockResolvedValueOnce(json({ not: "a list" }));
    await expect(store().monthUsageUsd()).rejects.toBeInstanceOf(AiStoreError);
  });
});
