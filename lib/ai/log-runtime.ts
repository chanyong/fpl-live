import { supabaseFromEnv } from "@/lib/ai/config";
import { createSupabaseLogStore } from "@/lib/ai/log-store";
import { readRecommendationLog, recordRecommendation, type ActualInputs, type LogDeps, type LogEntryView } from "@/lib/ai/rec-log";
import { createSupabaseAiStore } from "@/lib/ai/store";
import { getEntryPicks, getEventLive } from "@/lib/fpl-client";
import { getBase } from "@/lib/public-data";
import type { EntryRecommendPayload } from "@/lib/xp/recommend";
import { getXpTable } from "@/lib/xp/xp-table";

/**
 * The real dependencies of the recommendation log, read from the environment on first use. Without Supabase
 * settings no store is built and every log step is skipped. The AI switch does not matter here: the log makes
 * no paid call.
 */
let cached: LogDeps | null = null;

export function getLogDeps(): LogDeps {
  if (cached) {
    return cached;
  }

  const supabase = supabaseFromEnv();
  cached = {
    store: supabase ? createSupabaseLogStore(supabase) : null,
    aiLatest: supabase ? (key) => createSupabaseAiStore(supabase).latest(key) : null,
    async openDeadline() {
      const table = await getXpTable();
      if (!table?.targetDeadline) return null;
      return { gw: table.targetGw, deadlineAt: Date.parse(table.targetDeadline) };
    },
    async finishedGws() {
      const base = await getBase();
      return base ? new Set(base.bootstrap.events.filter((event) => event.finished).map((event) => event.id)) : null;
    },
    async fetchActual(entryId, gw): Promise<ActualInputs> {
      const [live, picks] = await Promise.all([getEventLive(gw), getEntryPicks(entryId, gw).catch(() => null)]);
      const captain = picks?.picks.find((pick) => pick.is_captain);
      return {
        points: new Map(live.elements.map((element) => [element.id, element.stats.total_points])),
        picks: picks
          ? {
              captainId: captain?.element ?? null,
              multiplier: captain?.multiplier ?? null,
              points: picks.entry_history.points,
              transferCost: picks.entry_history.event_transfers_cost
            }
          : null
      };
    },
    now: () => Date.now()
  };
  return cached;
}

/** Fire and forget: the recommendation response never waits for the log write and never sees its failure. */
export function recordInBackground(payload: EntryRecommendPayload) {
  void recordRecommendation(payload, getLogDeps()).catch(() => undefined);
}

export function loadRecommendationLog(entryId: number): Promise<LogEntryView[]> {
  return readRecommendationLog(entryId, getLogDeps());
}

/** For tests. */
export function resetLogDeps() {
  cached = null;
}
