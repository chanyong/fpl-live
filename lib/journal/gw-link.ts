import type { JournalNotes } from "@/lib/journal/types";

/** What the league page knows about the visitor's journal, boiled down from /api/journal/entries. */
export type JournalAccess =
  | { kind: "guest" }
  | { kind: "member"; teamId: number | null; savedGws: number[]; writtenGws: number[] }
  | { kind: "unavailable" };

export type JournalGwLink =
  | { kind: "hidden" }
  | { kind: "login"; href: string }
  | { kind: "write"; href: string }
  | { kind: "view"; href: string }
  /** Own team, but this week has no saved snapshot yet (it is saved after the gameweek finishes). */
  | { kind: "pending" };

/** The journal opens on the given week through its `gw` query, e.g. /journal?gw=12. */
export function journalGwHref(gw: number) {
  return `/journal?gw=${gw}`;
}

/** Reads `?gw=` back; anything but a whole number 1-38 is ignored. */
export function parseJournalGw(search: string) {
  const raw = new URLSearchParams(search).get("gw");
  if (!raw || !/^\d{1,2}$/.test(raw)) return null;
  const gw = Number(raw);
  return gw >= 1 && gw <= 38 ? gw : null;
}

export function hasWrittenNotes(notes: Omit<JournalNotes, "gw">) {
  return [notes.review, notes.good, notes.bad, notes.plan, notes.principles].some((value) => value.trim() !== "");
}

/**
 * Decides which journal link to show next to a gameweek on the league page.
 * `leagueEntryIds` are the teams in the league being viewed; only a member who owns one of them gets a write link.
 */
export function resolveJournalGwLink(input: {
  gw: number;
  currentGw: number;
  leagueEntryIds: readonly number[];
  access: JournalAccess;
}): JournalGwLink {
  const { gw, currentGw, leagueEntryIds, access } = input;
  if (!Number.isInteger(gw) || gw < 1 || gw > currentGw) return { kind: "hidden" };
  if (access.kind === "unavailable") return { kind: "hidden" };
  const href = journalGwHref(gw);
  if (access.kind === "guest") return { kind: "login", href };
  if (access.teamId === null || !leagueEntryIds.includes(access.teamId)) return { kind: "hidden" };
  if (!access.savedGws.includes(gw)) return { kind: "pending" };
  return access.writtenGws.includes(gw) ? { kind: "view", href } : { kind: "write", href };
}
