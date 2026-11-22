import { getBootstrapStatic, getFixtures } from "@/lib/fpl-client";
import {
  buildPublicFootball,
  buildPublicPlayers,
  type PublicFootball,
  type PublicPlayers
} from "@/lib/public-football";

/**
 * The server-rendered public pages (/premier-league, /fixtures, /players) read FPL here.
 *
 * - One bootstrap + fixtures pair, memoised for 60 seconds, so a crawler burst or a live-score refresh
 *   costs two FPL calls, not two per visit. The three pages share it.
 * - A page never waits longer than DEADLINE_MS for FPL: the fetch keeps running in the background and fills
 *   the memo, and this visit falls back to the last good copy (up to a day old) or to null.
 * - Null means "FPL did not answer and nothing is cached"; the page then shows a notice instead of failing.
 */
const TTL_MS = 60_000;
const STALE_MAX_MS = 24 * 60 * 60_000;
const DEADLINE_MS = 8_000;

type Base = { bootstrap: Awaited<ReturnType<typeof getBootstrapStatic>>; fixtures: Awaited<ReturnType<typeof getFixtures>> };

let cache: { base: Base; fetchedAt: number } | null = null;
let pending: Promise<Base> | null = null;

function refresh(): Promise<Base> {
  if (!pending) {
    pending = Promise.all([getBootstrapStatic(), getFixtures()])
      .then(([bootstrap, fixtures]) => {
        const base = { bootstrap, fixtures };
        cache = { base, fetchedAt: Date.now() };
        return base;
      })
      .finally(() => {
        pending = null;
      });
    // The page may have stopped waiting; keep a late failure from surfacing as an unhandled rejection.
    pending.catch(() => undefined);
  }
  return pending;
}

async function getBase(): Promise<Base | null> {
  if (cache && Date.now() - cache.fetchedAt < TTL_MS) {
    return cache.base;
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<"timeout">((resolve) => {
    timer = setTimeout(() => resolve("timeout"), DEADLINE_MS);
  });

  try {
    const result = await Promise.race([refresh(), timeout]);
    if (result !== "timeout") {
      return result;
    }
    console.error(`[public-data] FPL did not answer within ${DEADLINE_MS}ms`);
  } catch (error) {
    console.error("[public-data]", error);
  } finally {
    clearTimeout(timer);
  }

  return cache && Date.now() - cache.fetchedAt < STALE_MAX_MS ? cache.base : null;
}

export async function getPublicFootball(): Promise<PublicFootball | null> {
  const base = await getBase();
  return base ? buildPublicFootball(base.bootstrap, base.fixtures) : null;
}

export async function getPublicPlayers(): Promise<PublicPlayers | null> {
  const base = await getBase();
  return base ? buildPublicPlayers(base.bootstrap, base.fixtures) : null;
}

/** For tests: forget the memo. */
export function resetPublicDataCache() {
  cache = null;
  pending = null;
}
