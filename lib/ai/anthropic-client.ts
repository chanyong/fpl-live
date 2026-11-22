import Anthropic from "@anthropic-ai/sdk";
import { AI_EFFORT, AI_MAX_TOKENS, AI_MODEL_ID, AI_REQUEST_TIMEOUT_MS } from "@/lib/ai/config";
import type { TokenUsage } from "@/lib/ai/budget";
import { AI_OUTPUT_JSON_SCHEMA } from "@/lib/ai/schema";

/**
 * The only file that imports the Anthropic SDK. It is used from server routes only (nothing in a client
 * component imports lib/ai), so the SDK and the key never reach a browser bundle. The rest of the layer talks to
 * the small `AiClient` interface, which tests replace with a fake: no test makes a network call.
 *
 * Request facts (claude-api skill, Claude Fable 5.2):
 * - model id `claude-fable-5-2`, no date suffix;
 * - thinking is always on: the `thinking` parameter is NOT sent (`disabled` and `budget_tokens` return 400), and
 *   neither are sampling parameters (temperature / top_p / top_k return 400);
 * - depth is `output_config.effort`; the JSON answer is `output_config.format` (json_schema);
 * - streamed and collected into the final message, so a long answer does not hit an HTTP timeout;
 * - no cache_control, no server-side fallbacks (see the PR text: a fallback model would bill at another rate
 *   outside the reservation);
 * - SDK retries are off (maxRetries 0): every request is one counted call, retried by this layer at most once.
 */

export type AiCallRequest = { system: string; user: string };

export type AiCallResponse = {
  stopReason: string | null;
  /** All text blocks joined; thinking blocks are never read. */
  text: string;
  usage: TokenUsage;
};

export interface AiClient {
  generate(request: AiCallRequest): Promise<AiCallResponse>;
}

export class AiCallError extends Error {
  /** A code only: the SDK's own message can echo request details, so it is never kept. */
  constructor(readonly code: string) {
    super(code);
    this.name = "AiCallError";
  }
}

function codeOf(error: unknown) {
  if (error instanceof Anthropic.APIConnectionTimeoutError) return "api_timeout";
  if (error instanceof Anthropic.APIConnectionError) return "api_connection";
  if (error instanceof Anthropic.RateLimitError) return "api_rate_limit";
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) return "api_auth";
  if (error instanceof Anthropic.BadRequestError) return "api_bad_request";
  if (error instanceof Anthropic.APIError) return `api_${typeof error.status === "number" ? error.status : "error"}`;
  return "api_unknown";
}

export function createAnthropicClient(apiKey: string): AiClient {
  const client = new Anthropic({ apiKey, maxRetries: 0, timeout: AI_REQUEST_TIMEOUT_MS });

  return {
    async generate(request) {
      try {
        const stream = client.messages.stream({
          model: AI_MODEL_ID,
          max_tokens: AI_MAX_TOKENS,
          system: request.system,
          messages: [{ role: "user", content: request.user }],
          output_config: { effort: AI_EFFORT, format: { type: "json_schema", schema: { ...AI_OUTPUT_JSON_SCHEMA } } }
        });
        const message = await stream.finalMessage();
        const usage = message.usage;
        return {
          stopReason: message.stop_reason,
          text: message.content.map((block) => (block.type === "text" ? block.text : "")).join(""),
          usage: {
            input: usage.input_tokens ?? 0,
            output: usage.output_tokens ?? 0,
            cacheRead: usage.cache_read_input_tokens ?? 0,
            cacheWrite: usage.cache_creation_input_tokens ?? 0
          }
        };
      } catch (error) {
        throw new AiCallError(codeOf(error));
      }
    }
  };
}
