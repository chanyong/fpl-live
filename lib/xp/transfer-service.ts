import { EntryBusyError } from "@/lib/entry-squad";
import type { EntrySquadPayload } from "@/lib/squad-types";
import type { XpTable } from "@/lib/xp/model";
import {
  chipAvailability,
  searchTransfers,
  type TransferHorizon,
  type TransferSearchInput,
  type TransferSearchResult
} from "@/lib/xp/transfer-search";

/**
 * Transfer scenarios for one team, behind a small cache (issue #43 stage 1-B).
 *
 * - Result per (entryId, xP table builtAt, squad fetchedAt, horizon), kept 5 minutes, at most 200 of them.
 * - Concurrent requests for the same key share one search (the second does not take a search slot).
 * - At most 2 searches run at once in the whole process; a third is refused with EntryBusyError (the route
 *   answers 503 + Retry-After). Each search yields to the event loop every few milliseconds, so two of them
 *   plus normal traffic still run side by side.
 */
export const TRANSFER_CACHE_TTL_MS = 5 * 60_000;
export const TRANSFER_CACHE_MAX_ENTRIES = 200;
export const MAX_CONCURRENT_SEARCHES = 2;
const BUSY_RETRY_SECONDS = 2;

type Cached = { result: TransferSearchResult | null; expiresAt: number };

const cache = new Map<string, Cached>();
const inflight = new Map<string, Promise<TransferSearchResult | null>>();
let running = 0;

/** Search input from a loaded squad and the xP table; null when the squad is not a full 15 or a player is unknown to the table. */
export function toTransferInput(squad: EntrySquadPayload, table: XpTable, horizon: TransferHorizon): TransferSearchInput | null {
  if (squad.squad.length !== 15) {
    return null;
  }
  const players: TransferSearchInput["squad"] = [];
  for (const player of squad.squad) {
    const row = table.players.get(player.elementId);
    if (!row) {
      return null;
    }
    players.push({
      id: player.elementId,
      elementType: row.elementType,
      teamId: row.teamId,
      sellingPrice: player.sellingPrice,
      nowCost: player.nowCost
    });
  }
  return {
    squad: players,
    bank: squad.bank,
    freeTransfers: squad.transfers.freeTransfers,
    freeTransfersUnreliable: !squad.transfers.freeTransfersMatchHistory,
    table,
    horizon,
    chips: {
      wildcard: chipAvailability(squad.chips, table.targetGw, "wildcard"),
      freehit: chipAvailability(squad.chips, table.targetGw, "freehit")
    }
  };
}

export async function getTransfers(
  squad: EntrySquadPayload,
  table: XpTable,
  horizon: TransferHorizon,
  now = Date.now()
): Promise<TransferSearchResult | null> {
  const key = `${squad.entryId}:${table.builtAt}:${squad.fetchedAt}:${horizon}`;

  const hit = cache.get(key);
  if (hit && hit.expiresAt > now) {
    return hit.result;
  }
  const shared = inflight.get(key);
  if (shared) {
    return shared;
  }

  const input = toTransferInput(squad, table, horizon);
  if (!input) {
    return null;
  }
  if (running >= MAX_CONCURRENT_SEARCHES) {
    throw new EntryBusyError(BUSY_RETRY_SECONDS);
  }

  running += 1;
  const promise = searchTransfers(input)
    .then(({ result }) => {
      cache.delete(key);
      cache.set(key, { result, expiresAt: Date.now() + TRANSFER_CACHE_TTL_MS });
      while (cache.size > TRANSFER_CACHE_MAX_ENTRIES) {
        const oldest = cache.keys().next().value;
        if (oldest === undefined) break;
        cache.delete(oldest);
      }
      return result;
    })
    .finally(() => {
      running -= 1;
      inflight.delete(key);
    });
  inflight.set(key, promise);
  return promise;
}

/** For tests: forget the cache and any running search bookkeeping. */
export function resetTransferCache() {
  cache.clear();
  inflight.clear();
  running = 0;
}

export function transferCacheSize() {
  return cache.size;
}
