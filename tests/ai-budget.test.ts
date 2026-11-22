import { describe, expect, it } from "vitest";
import { costUsd, estimateInputTokens, maxCostPerCallUsd, withinInputCeiling } from "@/lib/ai/budget";
import {
  AI_EFFORT,
  AI_MAX_TOKENS,
  AI_MODEL_ID,
  ALLOWED_ENTRY_IDS,
  DAILY_CALL_CAP,
  DAILY_CAP_USD,
  AI_CALL_DEADLINE_MS,
  INPUT_TOKEN_CEILING,
  MAX_RETRIES,
  STALE_RUNNING_MS,
  MONTHLY_CAP_USD,
  aiConfigFromEnv,
  isAllowedEntry
} from "@/lib/ai/config";

// Issue #43 stage 3: the constants and the money arithmetic.
describe("constants", () => {
  it("pins the decided values", () => {
    expect(AI_MODEL_ID).toBe("claude-fable-5-2");
    expect(ALLOWED_ENTRY_IDS).toEqual([4300767]);
    expect(MONTHLY_CAP_USD).toBe(40);
    expect(DAILY_CAP_USD).toBe(5);
    expect(DAILY_CALL_CAP).toBe(10);
    expect(AI_MAX_TOKENS).toBe(16_000);
    expect(AI_EFFORT).toBe("medium");
  });

  it("allows only the owner's team", () => {
    expect(isAllowedEntry(4300767)).toBe(true);
    expect(isAllowedEntry(4300768)).toBe(false);
    expect(isAllowedEntry(0)).toBe(false);
  });
});

describe("cost per call", () => {
  it("is the input ceiling at $8 plus a full max_tokens of output at $40 per million", () => {
    expect(INPUT_TOKEN_CEILING).toBe(28_000);
    expect(maxCostPerCallUsd()).toBe(0.864);
    expect(maxCostPerCallUsd()).toBeCloseTo((28_000 * 8 + 16_000 * 40) / 1_000_000, 9);
  });

  it("the reservation is no smaller than any call the guards let through", () => {
    // Largest input allowed + largest output allowed cannot cost more than what is reserved.
    expect(costUsd({ input: INPUT_TOKEN_CEILING, output: AI_MAX_TOKENS, cacheRead: 0, cacheWrite: 0 })).toBeLessThanOrEqual(maxCostPerCallUsd());
  });

  it("prices a response from its usage, thinking tokens included in the output", () => {
    // Plan example: 13,500 in and 8,000 out is about $0.43.
    expect(costUsd({ input: 13_500, output: 8_000, cacheRead: 0, cacheWrite: 0 })).toBeCloseTo(0.428, 3);
    expect(costUsd({ input: 0, output: 1_000_000, cacheRead: 0, cacheWrite: 0 })).toBe(40);
    expect(costUsd({ input: 1_000_000, output: 0, cacheRead: 1_000_000, cacheWrite: 1_000_000 })).toBeCloseTo(8 + 0.2 + 16, 6);
  });

  it("how many calls fit: the daily cap is reached by the dollar limit before the monthly one", () => {
    expect(Math.floor(DAILY_CAP_USD / maxCostPerCallUsd())).toBe(5);
    expect(Math.floor(MONTHLY_CAP_USD / maxCostPerCallUsd())).toBe(46);
  });
});

describe("input ceiling", () => {
  it("counts a token per character (a token is never shorter) and refuses text beyond the ceiling", () => {
    expect(estimateInputTokens("abcd")).toBe(4);
    expect(withinInputCeiling("x".repeat(28_000))).toBe(true);
    expect(withinInputCeiling("x".repeat(28_001))).toBe(false);
    expect(withinInputCeiling("x".repeat(14_000), "y".repeat(14_000))).toBe(true);
    expect(withinInputCeiling("x".repeat(20_000), "y".repeat(20_001))).toBe(false);
  });

  it("a stale job is swept only after every call it can make has hit its deadline", () => {
    expect(STALE_RUNNING_MS).toBeGreaterThan((MAX_RETRIES + 1) * AI_CALL_DEADLINE_MS);
  });
});

describe("aiConfigFromEnv", () => {
  const full = { ANTHROPIC_API_KEY: "k", AI_RECOMMEND_ENABLED: "true", SUPABASE_URL: "http://x", SUPABASE_SERVICE_ROLE_KEY: "s" };

  it("is on only when the key, the flag and the Supabase settings are all present", () => {
    expect(aiConfigFromEnv(full).enabled).toBe(true);
    expect(aiConfigFromEnv({ ...full, ANTHROPIC_API_KEY: undefined }).enabled).toBe(false);
    expect(aiConfigFromEnv({ ...full, AI_RECOMMEND_ENABLED: undefined }).enabled).toBe(false);
    expect(aiConfigFromEnv({ ...full, SUPABASE_URL: undefined }).enabled).toBe(false);
    expect(aiConfigFromEnv({ ...full, SUPABASE_SERVICE_ROLE_KEY: "" }).enabled).toBe(false);
    expect(aiConfigFromEnv({}).enabled).toBe(false);
  });

  it("the flag must be exactly true", () => {
    for (const value of ["TRUE", "1", "yes", "false", "on", ""]) {
      expect(aiConfigFromEnv({ ...full, AI_RECOMMEND_ENABLED: value }).enabled).toBe(false);
    }
    expect(aiConfigFromEnv({ ...full, AI_RECOMMEND_ENABLED: " true " }).enabled).toBe(true);
  });

  it("does not hand out the key or database settings when off", () => {
    const off = aiConfigFromEnv({ ...full, AI_RECOMMEND_ENABLED: "false" });
    expect(off).toEqual({ enabled: false, apiKey: null, supabase: null });
  });
});
