export type RecentLeague = { id: number; name: string | null; viewedAt: number };

export const RECENT_LEAGUES_KEY = "fpl-live-recent-leagues";
/** The single id an earlier build kept. */
export const LEGACY_RECENT_KEY = "recentLeagueId";
export const RECENT_LEAGUES_MAX = 6;

/** Newest first, one entry per league, a name kept if a later visit didn't know it. */
export function addRecentLeague(list: RecentLeague[], entry: RecentLeague, max = RECENT_LEAGUES_MAX): RecentLeague[] {
  const previous = list.find((item) => item.id === entry.id);
  const merged: RecentLeague = { ...entry, name: entry.name ?? previous?.name ?? null };
  return [merged, ...list.filter((item) => item.id !== entry.id)].slice(0, max);
}

export function removeRecentLeague(list: RecentLeague[], id: number) {
  return list.filter((item) => item.id !== id);
}

/** Tolerates anything in storage: bad JSON, wrong shapes, non-positive ids. */
export function parseRecentLeagues(raw: string | null): RecentLeague[] {
  if (!raw) {
    return [];
  }
  try {
    const value = JSON.parse(raw) as unknown;
    if (!Array.isArray(value)) {
      return [];
    }
    return value
      .filter(
        (item): item is RecentLeague =>
          typeof item === "object" &&
          item !== null &&
          Number.isInteger((item as RecentLeague).id) &&
          (item as RecentLeague).id > 0
      )
      .map((item) => ({
        id: item.id,
        name: typeof item.name === "string" ? item.name.slice(0, 80) : null,
        viewedAt: typeof item.viewedAt === "number" ? item.viewedAt : 0
      }))
      .slice(0, RECENT_LEAGUES_MAX);
  } catch {
    return [];
  }
}

export function loadRecentLeagues(): RecentLeague[] {
  try {
    let list = parseRecentLeagues(window.localStorage.getItem(RECENT_LEAGUES_KEY));
    const legacy = window.localStorage.getItem(LEGACY_RECENT_KEY);
    if (legacy && /^\d+$/.test(legacy) && Number(legacy) > 0 && !list.some((item) => item.id === Number(legacy))) {
      list = [...list, { id: Number(legacy), name: null, viewedAt: 0 }].slice(0, RECENT_LEAGUES_MAX);
      window.localStorage.setItem(RECENT_LEAGUES_KEY, JSON.stringify(list));
    }
    if (legacy !== null) {
      window.localStorage.removeItem(LEGACY_RECENT_KEY);
    }
    return list;
  } catch {
    return [];
  }
}

export function saveRecentLeagues(list: RecentLeague[]) {
  try {
    window.localStorage.setItem(RECENT_LEAGUES_KEY, JSON.stringify(list));
  } catch {
    // Storage can be blocked (private mode); the list then just isn't remembered.
  }
}

export function rememberLeague(id: number, name: string | null) {
  const next = addRecentLeague(loadRecentLeagues(), { id, name, viewedAt: Date.now() });
  saveRecentLeagues(next);
  return next;
}
