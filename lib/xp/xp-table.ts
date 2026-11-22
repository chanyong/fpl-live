import { getBase } from "@/lib/public-data";
import { buildXpTable, type XpTable } from "@/lib/xp/model";

/**
 * The shared xP table for every visitor, memoised for 10 minutes (plan 3-6). It is rebuilt early once the
 * target gameweek's deadline passes, so the table never targets a gameweek that already locked.
 *
 * FPL's bootstrap and fixtures come from getBase() (60 s memo, stale copy up to a day on an outage), so this
 * adds no FPL call of its own. Null means FPL did not answer and nothing is cached, or the season is over.
 */
const TTL_MS = 10 * 60_000;

let cache: { table: XpTable; builtAt: number; deadlineAt: number | null } | null = null;

export async function getXpTable(now = Date.now()): Promise<XpTable | null> {
  if (cache && now - cache.builtAt < TTL_MS && (cache.deadlineAt === null || now < cache.deadlineAt)) {
    return cache.table;
  }

  const base = await getBase();
  if (!base) {
    return null;
  }

  const table = buildXpTable(base.bootstrap, base.fixtures, now);
  if (!table) {
    return null;
  }

  cache = {
    table,
    builtAt: now,
    deadlineAt: table.targetDeadline ? new Date(table.targetDeadline).getTime() : null
  };
  return table;
}

/** For tests: forget the memo. */
export function resetXpTableCache() {
  cache = null;
}
