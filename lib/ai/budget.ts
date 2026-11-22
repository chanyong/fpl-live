import { AI_MAX_TOKENS, INPUT_TOKEN_CEILING, PRICE_USD_PER_MTOK } from "@/lib/ai/config";

/**
 * The money arithmetic of the AI layer. The caps themselves are enforced in the database (lib/ai/store); this
 * file computes the amounts that go into it: what is reserved before a call and what a response really cost.
 */

export function roundUsd(value: number) {
  return Math.round(value * 1e6) / 1e6;
}

export type TokenUsage = { input: number; output: number; cacheRead: number; cacheWrite: number };

/** Cost of one response from its reported usage (output includes the thinking tokens). */
export function costUsd(usage: TokenUsage) {
  return roundUsd(
    (usage.input * PRICE_USD_PER_MTOK.input +
      usage.output * PRICE_USD_PER_MTOK.output +
      usage.cacheRead * PRICE_USD_PER_MTOK.cacheRead +
      usage.cacheWrite * PRICE_USD_PER_MTOK.cacheWrite) /
      1_000_000
  );
}

/**
 * Largest cost of one call: the input ceiling at the input price plus a full max_tokens of output at the output
 * price (30,000 x $8 + 16,000 x $40 per million = $0.24 + $0.64 = $0.88). This is the amount reserved in the
 * database before every call, a retry included; the settled cost replaces it once the real usage is known.
 */
export function maxCostPerCallUsd() {
  return roundUsd((INPUT_TOKEN_CEILING * PRICE_USD_PER_MTOK.input + AI_MAX_TOKENS * PRICE_USD_PER_MTOK.output) / 1_000_000);
}

/**
 * Upper-ish bound of the input tokens from the text length: one token per two characters. JSON of digits and
 * punctuation runs near 2-3 characters per token, so this leans high. It only gates the request: the real cost
 * is settled from the reported usage, and a request that would exceed the ceiling is not sent.
 */
export function estimateInputTokens(text: string) {
  return Math.ceil(text.length / 2);
}

export function withinInputCeiling(...texts: string[]) {
  return estimateInputTokens(texts.join("")) <= INPUT_TOKEN_CEILING;
}
