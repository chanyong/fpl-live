// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const captured = vi.hoisted(() => ({
  opts: null as Record<string, unknown> | null,
  params: null as Record<string, unknown> | null,
  message: null as unknown,
  error: null as unknown
}));

// The real SDK classes (so instanceof checks work) with the network call replaced.
vi.mock("@anthropic-ai/sdk", async (importActual) => {
  const actual = await importActual<typeof import("@anthropic-ai/sdk")>();
  const Real = actual.default;
  class Fake extends Real {
    constructor(opts: ConstructorParameters<typeof Real>[0]) {
      super(opts);
      captured.opts = opts as Record<string, unknown>;
      Object.defineProperty(this, "messages", {
        value: {
          stream: (params: Record<string, unknown>) => {
            captured.params = params;
            return {
              finalMessage: async () => {
                if (captured.error) throw captured.error;
                return captured.message;
              }
            };
          }
        }
      });
    }
  }
  return { ...actual, default: Fake };
});

import Anthropic from "@anthropic-ai/sdk";
import { AiCallError, createAnthropicClient } from "@/lib/ai/anthropic-client";
import { AI_MAX_TOKENS } from "@/lib/ai/config";
import { AiStoreError, createSupabaseAiStore } from "@/lib/ai/store";

// Issue #43 stage 2-3: the shape of the paid request, and of the database calls. No network in either.
describe("createAnthropicClient", () => {
  beforeEach(() => {
    captured.params = null;
    captured.error = null;
    captured.message = {
      stop_reason: "end_turn",
      content: [
        { type: "thinking", thinking: "", signature: "x" },
        { type: "text", text: '{"a":' },
        { type: "text", text: "1}" }
      ],
      usage: { input_tokens: 100, output_tokens: 200, cache_read_input_tokens: null, cache_creation_input_tokens: 5 }
    };
  });

  it("sends the Fable 5.2 request the skill describes and nothing the model rejects", async () => {
    const client = createAnthropicClient("test-key");
    await client.generate({ system: "SYS", user: "USER" });
    const params = captured.params!;
    expect(params).toMatchObject({
      model: "claude-fable-5-2",
      max_tokens: AI_MAX_TOKENS,
      system: "SYS",
      messages: [{ role: "user", content: "USER" }],
      output_config: { effort: "medium", format: { type: "json_schema" } }
    });
    // Always-on thinking: no thinking parameter; sampling parameters and cache control are not sent either.
    for (const key of ["thinking", "temperature", "top_p", "top_k", "cache_control", "tools", "tool_choice", "betas", "fallbacks"]) {
      expect(params).not.toHaveProperty(key);
    }
    expect(captured.opts).toMatchObject({ maxRetries: 0 });
  });

  it("joins the text blocks, ignores thinking, and reads the usage including cache fields", async () => {
    const result = await createAnthropicClient("k").generate({ system: "s", user: "u" });
    expect(result).toEqual({
      stopReason: "end_turn",
      text: '{"a":1}',
      usage: { input: 100, output: 200, cacheRead: 0, cacheWrite: 5 }
    });
  });

  it("turns SDK errors into a code, never keeping the SDK message", async () => {
    captured.error = new Anthropic.APIConnectionTimeoutError();
    await expect(createAnthropicClient("k").generate({ system: "s", user: "u" })).rejects.toMatchObject({ name: "AiCallError", code: "api_timeout" });
    captured.error = new Error("Authorization: Bearer sk-ant-leak");
    const failure = await createAnthropicClient("k")
      .generate({ system: "s", user: "u" })
      .catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(AiCallError);
    expect((failure as AiCallError).code).toBe("api_unknown");
    expect(String((failure as AiCallError).message)).not.toContain("sk-ant");
  });
});

describe("createSupabaseAiStore", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  const store = () => createSupabaseAiStore({ url: "https://db.example/", serviceKey: "svc-key" });
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  const lastCall = () => {
    const [url, init] = fetchMock.mock.calls.at(-1)!;
    return { url: String(url), init: init as RequestInit, body: init?.body ? JSON.parse(String(init.body)) : undefined };
  };

  it("starts a job through the database function with the caps, and maps the answer", async () => {
    fetchMock.mockResolvedValue(json({ ok: true, job_id: "j1", usage_id: "u1", generation: 2 }));
    const result = await store().startJob({
      entryId: 4300767, targetGw: 12, locale: "ko", kind: "manual", inputHash: "h", modelId: "claude-fable-5-2", modelVersion: "xp1", basis: { a: 1 }, reserveUsd: 0.88
    });
    expect(result).toEqual({ ok: true, jobId: "j1", usageId: "u1", generation: 2 });
    const call = lastCall();
    expect(call.url).toBe("https://db.example/rest/v1/rpc/ai_start_job");
    expect(call.body).toMatchObject({
      p_entry_id: 4300767, p_target_gw: 12, p_locale: "ko", p_kind: "manual", p_reserve_usd: 0.88,
      p_month_cap_usd: 40, p_day_cap_usd: 5, p_day_call_cap: 10, p_max_generations: 3, p_manual_per_day: 1
    });
    expect((call.init.headers as Record<string, string>).Authorization).toBe("Bearer svc-key");
  });

  it("maps each refusal reason and rejects an answer it does not know (fail closed)", async () => {
    for (const reason of ["busy", "exists", "regen_limit", "month_limit", "day_limit", "day_calls_limit"]) {
      fetchMock.mockResolvedValueOnce(json({ ok: false, reason }));
      const result = await store().startJob({ entryId: 1, targetGw: 1, locale: "en", kind: "first", inputHash: "h", modelId: "m", modelVersion: "v", basis: {}, reserveUsd: 1 });
      expect(result).toEqual({ ok: false, reason });
    }
    fetchMock.mockResolvedValueOnce(json({ ok: false, reason: "something_new" }));
    await expect(store().startJob({ entryId: 1, targetGw: 1, locale: "en", kind: "first", inputHash: "h", modelId: "m", modelVersion: "v", basis: {}, reserveUsd: 1 })).rejects.toBeInstanceOf(AiStoreError);
    fetchMock.mockResolvedValueOnce(json(null));
    await expect(store().reserveUsage("j", 1)).rejects.toBeInstanceOf(AiStoreError);
  });

  it("throws on an HTTP error, a network error, and never carries a response body", async () => {
    fetchMock.mockResolvedValueOnce(json({ message: "secret detail" }, 500));
    const error = await store().latest({ entryId: 1, targetGw: 1, locale: "ko" }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AiStoreError);
    expect((error as AiStoreError).status).toBe(500);
    expect((error as AiStoreError).message).not.toContain("secret");
    fetchMock.mockRejectedValueOnce(new Error("socket hang up"));
    await expect(store().sweepStale({ entryId: 1, targetGw: 1, locale: "ko" }, "2026-01-01T00:00:00Z")).rejects.toMatchObject({ status: 0 });
  });

  it("reserves a retry, settles with the real cost, and closes jobs only while they run", async () => {
    fetchMock.mockResolvedValueOnce(json({ ok: true, usage_id: "u2" }));
    expect(await store().reserveUsage("j1", 0.88)).toEqual({ ok: true, usageId: "u2" });
    expect(lastCall().url).toContain("/rpc/ai_reserve_usage");

    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await store().settleUsage("u2", { costUsd: 0.42, inputTokens: 1000, outputTokens: 2000 });
    expect(lastCall().url).toContain("/rest/v1/ai_usage?id=eq.u2");
    expect(lastCall().init.method).toBe("PATCH");
    expect(lastCall().body).toMatchObject({ status: "settled", cost_usd: 0.42, input_tokens: 1000, output_tokens: 2000 });

    await store().failUsage("u2");
    expect(lastCall().url).toContain("status=eq.reserved");
    await store().completeJob("j1", { a: 1 });
    expect(lastCall().url).toContain("id=eq.j1&status=eq.running");
    expect(lastCall().body).toMatchObject({ status: "done", result: { a: 1 } });
    await store().failJob("j1", "refusal");
    expect(lastCall().body).toMatchObject({ status: "failed", failure_code: "refusal" });
  });

  it("reads the latest rows of a key and sorts them into running, done and failed", async () => {
    const row = (id: string, status: string, gen: number) => ({
      id, generation: gen, request_kind: gen === 1 ? "first" : "manual", status, result: status === "done" ? { a: 1 } : null, basis: {}, failure_code: status === "failed" ? "x" : null,
      model_id: "m", model_version: "xp1", created_at: "2026-11-22T00:00:00Z", completed_at: null
    });
    fetchMock.mockResolvedValue(json([row("c", "running", 3), row("b", "done", 2), row("a", "failed", 1)]));
    const latest = await store().latest({ entryId: 4300767, targetGw: 12, locale: "ko" });
    expect(latest.running?.id).toBe("c");
    expect(latest.done?.id).toBe("b");
    expect(latest.failed?.id).toBe("a");
    expect(lastCall().url).toContain("entry_id=eq.4300767&target_gw=eq.12&locale=eq.ko");
  });
});
