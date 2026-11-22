import { beforeAll, describe, expect, it } from "vitest";
import { validateAiOutput, AI_OUTPUT_JSON_SCHEMA, type ValidationContext } from "@/lib/ai/schema";
import type { AiInput } from "@/lib/ai/input-bundle";
import { makeAiInput, validAnswer } from "./helpers/ai";

// Issue #43 stage 2: the server check of the model's answer. One broken rule discards the whole answer.
let input: AiInput;
let ctx: ValidationContext;
beforeAll(async () => {
  input = (await makeAiInput()).input;
  ctx = input.context;
});

const check = (override: Record<string, unknown>) => validateAiOutput(validAnswer(input, override), ctx);
const code = (override: Record<string, unknown>) => {
  const result = check(override);
  return result.ok ? "ok" : result.code;
};

describe("validateAiOutput", () => {
  it("accepts a good answer and replaces placeholders with the player's name", () => {
    const result = validateAiOutput(validAnswer(input), ctx);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const captain = ctx.captainIds[0];
    expect(result.value.summary).toBe(`Start Zorro${captain} and keep the rest steady.`);
    expect(JSON.stringify(result.value)).not.toContain("{p");
    expect(result.value.captain.map((item) => item.rank)).toEqual([1, 2]);
  });

  it("sorts captains by rank and transfers by priority", () => {
    const base = validAnswer(input);
    const result = validateAiOutput(
      { ...base, captain: [...base.captain].reverse(), transfers: [...base.transfers].reverse() },
      ctx
    );
    expect(result.ok && result.value.captain[0].rank).toBe(1);
    expect(result.ok && result.value.transfers[0].priority).toBe(1);
  });

  it("rejects a lineup option the server did not offer", () => {
    expect(code({ lineup: { option_id: "L9", reason: "x" } })).toBe("schema");
    const onlyL1 = validateAiOutput(validAnswer(input, { lineup: { option_id: "L3", reason: "Fine." } }), { ...ctx, lineupOptionIds: ["L1"] });
    expect(onlyL1).toEqual({ ok: false, code: "unknown_lineup_option" });
  });

  it("rejects a captain who is not among the candidates, a repeated captain and a repeated or out-of-range rank", () => {
    const base = validAnswer(input);
    expect(code({ captain: [{ ...base.captain[0], player_id: 99999 }] })).toBe("unknown_captain");
    expect(code({ captain: [base.captain[0], { ...base.captain[1], player_id: base.captain[0].player_id }] })).toBe("captain_duplicate_player");
    expect(code({ captain: [base.captain[0], { ...base.captain[1], rank: 1 }] })).toBe("captain_rank");
    expect(code({ captain: [{ ...base.captain[0], rank: 4 }] })).toBe("captain_rank");
    expect(code({ captain: [] })).toBe("captain_empty");
    expect(code({ captain: [1, 2, 3, 4].map((rank) => ({ ...base.captain[0], rank })) })).toBe("schema");
  });

  it("rejects a scenario or a priority the server did not offer", () => {
    const base = validAnswer(input);
    expect(base.transfers.length).toBeGreaterThan(1);
    expect(code({ transfers: [{ ...base.transfers[0], scenario_id: "one:1>99999" }] })).toBe("unknown_scenario");
    expect(code({ transfers: [base.transfers[0], { ...base.transfers[1], priority: 1 }] })).toBe("transfer_priority");
    expect(code({ transfers: [base.transfers[0], { ...base.transfers[1], scenario_id: base.transfers[0].scenario_id }] })).toBe("transfer_duplicate_scenario");
    expect(code({ transfers: [{ ...base.transfers[0], confidence: "certain" }] })).toBe("schema");
    expect(validateAiOutput(validAnswer(input, { transfers: [] }), { ...ctx, scenarioIds: [] }).ok).toBe(true);
    expect(validateAiOutput(validAnswer(input), { ...ctx, scenarioIds: [] })).toEqual({ ok: false, code: "unknown_scenario" });
  });

  it("rejects a watch-list player the model was not given", () => {
    expect(code({ watch_list: [{ player_id: 99999, note: "Check news." }] })).toBe("unknown_watch_player");
  });

  it("rejects a placeholder for a player who is not a candidate or has no name", () => {
    expect(code({ summary: "Look at {p99999} please." })).toBe("unknown_player");
    const known = ctx.knownPlayerIds[0];
    const noName = validateAiOutput(validAnswer(input, { summary: `Look at {p${known}}.` }), { ...ctx, playerNames: new Map() });
    expect(noName).toEqual({ ok: false, code: "unknown_player" });
  });

  it("rejects any digit outside a placeholder (ASCII and other scripts)", () => {
    expect(code({ summary: "He scores 5 points." })).toBe("digit_outside_placeholder");
    expect(code({ summary: "다음 3경기가 쉽다." })).toBe("digit_outside_placeholder");
    expect(code({ summary: "Fullwidth ５ counts too." })).toBe("digit_outside_placeholder");
    expect(code({ chip_note: "Use it in gameweek 12." })).toBe("digit_outside_placeholder");
    const captain = ctx.captainIds[0];
    expect(code({ summary: `Only {p${captain}} matters.` })).toBe("ok");
  });

  it("rejects HTML, links, entities and leftover braces", () => {
    expect(code({ summary: "<b>Buy</b> now" })).toBe("markup");
    expect(code({ summary: "See https://example.com" })).toBe("markup");
    expect(code({ summary: "See www.example.com" })).toBe("markup");
    expect(code({ summary: "A [link](x)" })).toBe("markup");
    expect(code({ summary: "Fish &amp; chips" })).toBe("markup");
    expect(code({ summary: "Hello {name}" })).toBe("bad_placeholder");
    expect(code({ summary: "Line one\nline two" })).toBe("control_chars");
  });

  it("enforces text length limits and non-empty sentences", () => {
    expect(code({ summary: "a".repeat(901) })).toBe("text_too_long");
    expect(code({ summary: "a".repeat(900) })).toBe("ok");
    expect(code({ summary: "   " })).toBe("empty_text");
    expect(code({ lineup: { option_id: "L1", reason: "" } })).toBe("empty_text");
    // The chip note may be empty (no chip to talk about).
    expect(code({ chip_note: "" })).toBe("ok");
  });

  it("rejects extra keys, missing keys and wrong types", () => {
    expect(code({ extra: 1 })).toBe("schema");
    expect(code({ weight_pct: 50 })).toBe("schema");
    expect(validateAiOutput({}, ctx)).toEqual({ ok: false, code: "schema" });
    expect(validateAiOutput("text", ctx)).toEqual({ ok: false, code: "schema" });
    expect(validateAiOutput(null, ctx)).toEqual({ ok: false, code: "schema" });
    const base = validAnswer(input);
    expect(code({ captain: [{ ...base.captain[0], player_id: "7" }] })).toBe("schema");
    expect(code({ captain: [{ ...base.captain[0], weight_pct: 55 }] })).toBe("schema");
    expect(code({ disagreements: [{ topic: "chip", note: "x" }] })).toBe("schema");
  });

  it("the JSON schema sent to the API names exactly the keys the validator accepts, and nothing server-owned", () => {
    expect(Object.keys(AI_OUTPUT_JSON_SCHEMA.properties).sort()).toEqual(
      ["captain", "chip_note", "disagreements", "lineup", "summary", "transfers", "watch_list"].sort()
    );
    const text = JSON.stringify(AI_OUTPUT_JSON_SCHEMA);
    for (const serverOwned of ["basis", "starters", "weight_pct", "expected_gain", "do_by", "type\":\"roll"]) {
      expect(text).not.toContain(serverOwned);
    }
  });
});
