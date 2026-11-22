/**
 * The team a visitor chose as "mine" (issue #39 stage 2). No login: the ID lives only in this browser's
 * storage and is never sent to the server except as the ID in the squad address.
 */
export type MyTeam = { id: number; name: string | null };

export const MY_TEAM_KEY = "fpl-live-my-team";

/** Tolerates anything in storage: bad JSON, wrong shapes, non-positive ids. */
export function parseMyTeam(raw: string | null): MyTeam | null {
  if (!raw) {
    return null;
  }
  try {
    const value = JSON.parse(raw) as unknown;
    if (typeof value !== "object" || value === null) {
      return null;
    }
    const { id, name } = value as { id?: unknown; name?: unknown };
    if (typeof id !== "number" || !Number.isInteger(id) || id <= 0) {
      return null;
    }
    return { id, name: typeof name === "string" ? name.slice(0, 80) : null };
  } catch {
    return null;
  }
}

export function loadMyTeam(): MyTeam | null {
  try {
    return parseMyTeam(window.localStorage.getItem(MY_TEAM_KEY));
  } catch {
    return null;
  }
}

export function saveMyTeam(team: MyTeam) {
  try {
    window.localStorage.setItem(MY_TEAM_KEY, JSON.stringify(team));
  } catch {
    // Storage can be blocked (private mode); the team then just isn't remembered.
  }
}

export function clearMyTeam() {
  try {
    window.localStorage.removeItem(MY_TEAM_KEY);
  } catch {
    // See above.
  }
}

/** What a visitor types for a team ID: digits only, as FPL shows it in the address of its own pages. */
export function parseTeamIdInput(raw: string): number | null {
  const text = raw.trim();
  if (!/^\d{1,10}$/.test(text)) {
    return null;
  }
  const id = Number(text);
  return id > 0 && id <= 2_000_000_000 ? id : null;
}
