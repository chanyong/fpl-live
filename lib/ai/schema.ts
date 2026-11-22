import { z } from "zod";

/**
 * What the model may return, and the server-side check of it (issue #43, stage 2).
 *
 * The model only ranks and explains inside the candidates the server computed. It never writes a lineup, an
 * amount, a transfer type, a deadline or a captain weight: those are server values shown beside its text.
 * Any rule broken below discards the WHOLE answer (the screen then shows the rules-based result only).
 *
 * Sentences name players only as `{p123}` placeholders; the server replaces them with the player's name, so a
 * stored sentence is plain text. Outside the placeholders no digit may appear (a number in prose could
 * contradict the server's figures), and no HTML or link.
 */

export const LINEUP_OPTION_IDS = ["L1", "L2", "L3"] as const;
export const CONFIDENCE_LEVELS = ["low", "medium", "high"] as const;
export const DISAGREEMENT_TOPICS = ["captain", "lineup", "transfer"] as const;

export const TEXT_LIMITS = { summary: 900, reason: 500, risk: 300, chipNote: 500, note: 300 } as const;
export const LIMITS = { captain: 3, transfers: 6, watch: 5, disagreements: 3 } as const;

export type AiResult = {
  summary: string;
  lineup: { option_id: (typeof LINEUP_OPTION_IDS)[number]; reason: string };
  captain: Array<{ rank: number; player_id: number; reason: string; risk: string }>;
  transfers: Array<{
    priority: number;
    scenario_id: string;
    reason: string;
    risk: string;
    confidence: (typeof CONFIDENCE_LEVELS)[number];
  }>;
  chip_note: string;
  watch_list: Array<{ player_id: number; note: string }>;
  disagreements: Array<{ topic: (typeof DISAGREEMENT_TOPICS)[number]; note: string }>;
};

/** JSON Schema sent as output_config.format. Static on purpose (a per-request schema would be recompiled each time); numeric and length limits are enforced below, the API does not support them. */
export const AI_OUTPUT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "lineup", "captain", "transfers", "chip_note", "watch_list", "disagreements"],
  properties: {
    summary: { type: "string" },
    lineup: {
      type: "object",
      additionalProperties: false,
      required: ["option_id", "reason"],
      properties: { option_id: { type: "string", enum: [...LINEUP_OPTION_IDS] }, reason: { type: "string" } }
    },
    captain: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["rank", "player_id", "reason", "risk"],
        properties: { rank: { type: "integer" }, player_id: { type: "integer" }, reason: { type: "string" }, risk: { type: "string" } }
      }
    },
    transfers: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["priority", "scenario_id", "reason", "risk", "confidence"],
        properties: {
          priority: { type: "integer" },
          scenario_id: { type: "string" },
          reason: { type: "string" },
          risk: { type: "string" },
          confidence: { type: "string", enum: [...CONFIDENCE_LEVELS] }
        }
      }
    },
    chip_note: { type: "string" },
    watch_list: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["player_id", "note"],
        properties: { player_id: { type: "integer" }, note: { type: "string" } }
      }
    },
    disagreements: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["topic", "note"],
        properties: { topic: { type: "string", enum: [...DISAGREEMENT_TOPICS] }, note: { type: "string" } }
      }
    }
  }
} as const;

const shape = z
  .object({
    summary: z.string(),
    lineup: z.object({ option_id: z.enum(LINEUP_OPTION_IDS), reason: z.string() }).strict(),
    captain: z
      .array(z.object({ rank: z.number().int(), player_id: z.number().int(), reason: z.string(), risk: z.string() }).strict())
      .max(LIMITS.captain),
    transfers: z
      .array(
        z
          .object({
            priority: z.number().int(),
            scenario_id: z.string(),
            reason: z.string(),
            risk: z.string(),
            confidence: z.enum(CONFIDENCE_LEVELS)
          })
          .strict()
      )
      .max(LIMITS.transfers),
    chip_note: z.string(),
    watch_list: z.array(z.object({ player_id: z.number().int(), note: z.string() }).strict()).max(LIMITS.watch),
    disagreements: z.array(z.object({ topic: z.enum(DISAGREEMENT_TOPICS), note: z.string() }).strict()).max(LIMITS.disagreements)
  })
  .strict();

export type ValidationContext = {
  /** Lineup options the server offered: "L1".."L3" (as many as exist). */
  lineupOptionIds: readonly string[];
  /** The captain candidates the server offered (up to five). */
  captainIds: readonly number[];
  /** Transfer scenario IDs the server offered (empty when there were none). */
  scenarioIds: readonly string[];
  /** Every player ID the model was given; placeholders and the watch list may name only these. */
  knownPlayerIds: readonly number[];
  /** Display names for the placeholders (server data, not sent to the model). */
  playerNames: ReadonlyMap<number, string>;
};

export type ValidationResult = { ok: true; value: AiResult } | { ok: false; code: string };

const PLACEHOLDER = /\{p(\d{1,9})\}/g;
const FORBIDDEN_MARKUP = /[<>]|&[#a-z0-9]+;|https?:|:\/\/|www\.|javascript:|\]\(|`/i;
const CONTROL_CHARS = /[\x00-\x1f\x7f]|\p{Zl}|\p{Zp}/u;
const ANY_DIGIT = /\p{N}/u;

type Fail = { fail: string };
const failed = (value: unknown): value is Fail => typeof value === "object" && value !== null && "fail" in value;

/** One sentence: length, no markup, no digits outside placeholders, placeholders known; returns the plain text with names filled in. */
function checkSentence(raw: string, max: number, ctx: ValidationContext, allowEmpty = false): string | Fail {
  const text = raw.trim();
  if (text.length === 0) return allowEmpty ? "" : { fail: "empty_text" };
  if (text.length > max) return { fail: "text_too_long" };
  if (CONTROL_CHARS.test(text)) return { fail: "control_chars" };
  if (FORBIDDEN_MARKUP.test(text)) return { fail: "markup" };

  const outside = text.replace(PLACEHOLDER, "");
  if (ANY_DIGIT.test(outside)) return { fail: "digit_outside_placeholder" };
  if (/[{}]/.test(outside)) return { fail: "bad_placeholder" };

  let unknown = false;
  const known = new Set(ctx.knownPlayerIds);
  const replaced = text.replace(PLACEHOLDER, (_match, digits: string) => {
    const id = Number(digits);
    const name = ctx.playerNames.get(id);
    if (!known.has(id) || !name) {
      unknown = true;
      return "";
    }
    return name.replace(/[<>{}`]/g, "").trim();
  });
  return unknown ? { fail: "unknown_player" } : replaced;
}

function hasDuplicates<T>(values: T[]) {
  return new Set(values).size !== values.length;
}

/** Parses and checks the model's JSON. A single violation fails the whole answer. */
export function validateAiOutput(raw: unknown, ctx: ValidationContext): ValidationResult {
  const parsed = shape.safeParse(raw);
  if (!parsed.success) return { ok: false, code: "schema" };
  const data = parsed.data;

  if (!ctx.lineupOptionIds.includes(data.lineup.option_id)) return { ok: false, code: "unknown_lineup_option" };

  if (data.captain.length < 1) return { ok: false, code: "captain_empty" };
  const captainRanks = data.captain.map((item) => item.rank);
  if (hasDuplicates(captainRanks) || captainRanks.some((rank) => rank < 1 || rank > LIMITS.captain)) return { ok: false, code: "captain_rank" };
  if (hasDuplicates(data.captain.map((item) => item.player_id))) return { ok: false, code: "captain_duplicate_player" };
  if (data.captain.some((item) => !ctx.captainIds.includes(item.player_id))) return { ok: false, code: "unknown_captain" };

  const priorities = data.transfers.map((item) => item.priority);
  if (hasDuplicates(priorities) || priorities.some((priority) => priority < 1 || priority > LIMITS.transfers)) return { ok: false, code: "transfer_priority" };
  if (hasDuplicates(data.transfers.map((item) => item.scenario_id))) return { ok: false, code: "transfer_duplicate_scenario" };
  if (data.transfers.some((item) => !ctx.scenarioIds.includes(item.scenario_id))) return { ok: false, code: "unknown_scenario" };

  const known = new Set(ctx.knownPlayerIds);
  if (data.watch_list.some((item) => !known.has(item.player_id))) return { ok: false, code: "unknown_watch_player" };
  if (hasDuplicates(data.watch_list.map((item) => item.player_id))) return { ok: false, code: "watch_duplicate_player" };

  const summary = checkSentence(data.summary, TEXT_LIMITS.summary, ctx);
  const lineupReason = checkSentence(data.lineup.reason, TEXT_LIMITS.reason, ctx);
  const chipNote = checkSentence(data.chip_note, TEXT_LIMITS.chipNote, ctx, true);
  const captain = data.captain.map((item) => ({
    rank: item.rank,
    player_id: item.player_id,
    reason: checkSentence(item.reason, TEXT_LIMITS.reason, ctx),
    risk: checkSentence(item.risk, TEXT_LIMITS.risk, ctx)
  }));
  const transfers = data.transfers.map((item) => ({
    priority: item.priority,
    scenario_id: item.scenario_id,
    reason: checkSentence(item.reason, TEXT_LIMITS.reason, ctx),
    risk: checkSentence(item.risk, TEXT_LIMITS.risk, ctx),
    confidence: item.confidence
  }));
  const watch = data.watch_list.map((item) => ({ player_id: item.player_id, note: checkSentence(item.note, TEXT_LIMITS.note, ctx) }));
  const disagreements = data.disagreements.map((item) => ({ topic: item.topic, note: checkSentence(item.note, TEXT_LIMITS.note, ctx) }));

  const texts: Array<string | Fail> = [
    summary,
    lineupReason,
    chipNote,
    ...captain.flatMap((item) => [item.reason, item.risk]),
    ...transfers.flatMap((item) => [item.reason, item.risk]),
    ...watch.map((item) => item.note),
    ...disagreements.map((item) => item.note)
  ];
  const bad = texts.find(failed);
  if (bad) return { ok: false, code: bad.fail };

  const text = (value: string | Fail) => value as string;
  return {
    ok: true,
    value: {
      summary: text(summary),
      lineup: { option_id: data.lineup.option_id, reason: text(lineupReason) },
      captain: captain
        .map((item) => ({ ...item, reason: text(item.reason), risk: text(item.risk) }))
        .sort((a, b) => a.rank - b.rank),
      transfers: transfers
        .map((item) => ({ ...item, reason: text(item.reason), risk: text(item.risk) }))
        .sort((a, b) => a.priority - b.priority),
      chip_note: text(chipNote),
      watch_list: watch.map((item) => ({ ...item, note: text(item.note) })),
      disagreements: disagreements.map((item) => ({ ...item, note: text(item.note) }))
    }
  };
}
