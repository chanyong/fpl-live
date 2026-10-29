import { getBootstrapStatic, getStandingsPage } from "@/lib/fpl-client";
import { getCurrentGw } from "@/lib/gameweek";

/**
 * League name + current gameweek for page titles and share cards.
 *
 * Crawlers and the page itself ask for this on every share/visit, so it is memoised in memory:
 * league names for 30 minutes, the current gameweek (from the 1–2 MB bootstrap) for 10 minutes.
 * That keeps metadata from adding FPL calls on top of what the dashboard already makes.
 */
const NAME_TTL_MS = 30 * 60_000;
const GW_TTL_MS = 10 * 60_000;
const MAX_NAMES = 500;

const names = new Map<number, { name: string; expiresAt: number }>();
const pendingNames = new Map<number, Promise<string>>();
let gwCache: { gw: number; expiresAt: number } | null = null;
let pendingGw: Promise<number> | null = null;

export async function getLeagueName(leagueId: number): Promise<string> {
  const hit = names.get(leagueId);
  if (hit && hit.expiresAt > Date.now()) {
    return hit.name;
  }
  const inFlight = pendingNames.get(leagueId);
  if (inFlight) {
    return inFlight;
  }
  const request = getStandingsPage(leagueId, 1)
    .then((page) => {
      if (names.size >= MAX_NAMES) {
        const oldest = names.keys().next();
        if (!oldest.done) names.delete(oldest.value);
      }
      names.set(leagueId, { name: page.league.name, expiresAt: Date.now() + NAME_TTL_MS });
      return page.league.name;
    })
    .finally(() => pendingNames.delete(leagueId));
  pendingNames.set(leagueId, request);
  return request;
}

export async function getCurrentGameweek(): Promise<number | null> {
  if (gwCache && gwCache.expiresAt > Date.now()) {
    return gwCache.gw;
  }
  if (!pendingGw) {
    pendingGw = getBootstrapStatic()
      .then((bootstrap) => {
        const gw = getCurrentGw(bootstrap.events);
        gwCache = { gw, expiresAt: Date.now() + GW_TTL_MS };
        return gw;
      })
      .finally(() => {
        pendingGw = null;
      });
  }
  try {
    return await pendingGw;
  } catch {
    return gwCache?.gw ?? null;
  }
}

export async function getLeagueMeta(leagueId: number) {
  const [name, gw] = await Promise.all([getLeagueName(leagueId), getCurrentGameweek()]);
  return { name, gw };
}
