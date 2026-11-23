import { createAnthropicClient } from "@/lib/ai/anthropic-client";
import { aiConfigFromEnv } from "@/lib/ai/config";
import { buildFullInput } from "@/lib/ai/full-input";
import { buildAiInput } from "@/lib/ai/input-bundle";
import { loadPlayerMeta } from "@/lib/ai/players";
import type { AiDeps } from "@/lib/ai/recommend";
import { createSupabaseAiStore } from "@/lib/ai/store";
import { getEntrySquad } from "@/lib/entry-squad";
import { FplUnavailableError, getEntryRecommend, makeCardBuilder } from "@/lib/xp/recommend";
import { getXpTable } from "@/lib/xp/xp-table";

/**
 * The real dependencies of the AI flow, read from the environment on first use. When the layer is off (no key,
 * no flag, no Supabase settings) nothing is constructed: no Anthropic client, no database connection.
 */
let cached: AiDeps | null = null;

export function getAiDeps(): AiDeps {
  if (cached) {
    return cached;
  }

  const config = aiConfigFromEnv();
  cached = {
    config,
    store: config.enabled && config.supabase ? createSupabaseAiStore(config.supabase) : null,
    client: config.enabled && config.apiKey ? createAnthropicClient(config.apiKey) : null,
    async loadInput(entryId, locale) {
      const [payload, table, meta] = await Promise.all([getEntryRecommend(entryId, false, 3), getXpTable(), loadPlayerMeta()]);
      if (!table) {
        throw new FplUnavailableError();
      }
      return buildAiInput({ payload, table, meta, locale });
    },
    async loadFullInput(entryId, locale) {
      // The squad (selling prices) and the recommendation read the same 5-minute squad cache and the same xP table.
      const [squad, payload, table, meta] = await Promise.all([
        getEntrySquad(entryId, false),
        getEntryRecommend(entryId, false, 3),
        getXpTable(),
        loadPlayerMeta()
      ]);
      if (!table) {
        throw new FplUnavailableError();
      }
      const cardOf = await makeCardBuilder(squad, table);
      return buildFullInput({
        payload,
        table,
        meta,
        locale,
        squad: squad.squad.map((player) => ({ id: player.elementId, sellingPrice: player.sellingPrice, nowCost: player.nowCost })),
        cardOf
      });
    },
    async targetGw() {
      return (await getXpTable())?.targetGw ?? null;
    },
    schedule(job) {
      // The response has already gone out; the job settles itself and never throws (runJob catches everything).
      void job;
    },
    now: () => Date.now()
  };
  return cached;
}

/** For tests. */
export function resetAiDeps() {
  cached = null;
}
