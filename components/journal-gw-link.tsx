"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useLocale } from "@/components/locale-provider";
import { hasWrittenNotes, resolveJournalGwLink, type JournalAccess } from "@/lib/journal/gw-link";
import type { JournalNotes } from "@/lib/journal/types";

type EntriesPayload = {
  teamId: number | null;
  snapshots: Array<{ gw: number }>;
  notes: JournalNotes[];
};

async function fetchJournalAccess(): Promise<JournalAccess> {
  const response = await fetch("/api/journal/entries", { cache: "no-store" });
  if (response.status === 401) return { kind: "guest" };
  if (!response.ok) return { kind: "unavailable" };
  const data = (await response.json()) as EntriesPayload;
  return {
    kind: "member",
    teamId: data.teamId,
    savedGws: data.snapshots.map((item) => item.gw),
    writtenGws: data.notes.filter(hasWrittenNotes).map((note) => note.gw)
  };
}

/** One shared request per page: every GW link on the league page reads the same cached answer. */
function useJournalAccess() {
  return useQuery({
    queryKey: ["journal-access"],
    queryFn: fetchJournalAccess,
    staleTime: 60_000,
    retry: false,
    refetchOnWindowFocus: false
  });
}

const linkClass =
  "inline-flex min-h-9 shrink-0 items-center whitespace-nowrap rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 text-caption font-semibold text-[var(--accent)] transition hover:border-[var(--accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]";

/** Link from a league-page gameweek to that week's journal entry (/journal?gw=N). */
export function JournalGwLink({
  gw,
  currentGw,
  leagueEntryIds
}: {
  gw: number;
  currentGw: number;
  leagueEntryIds: readonly number[];
}) {
  const { tr } = useLocale();
  const { data } = useJournalAccess();
  if (!data) return null;

  const link = resolveJournalGwLink({ gw, currentGw, leagueEntryIds, access: data });
  if (link.kind === "hidden") return null;
  if (link.kind === "pending") {
    return (
      <span className="shrink-0 text-caption text-[var(--muted)]">
        {tr("일지는 GW 종료 후", "Journal after GW ends")}
      </span>
    );
  }

  const label =
    link.kind === "login"
      ? tr("로그인 후 일지 쓰기", "Log in to write")
      : link.kind === "view"
        ? tr("일지 보기", "View journal")
        : tr("일지 쓰기", "Write journal");
  return (
    <Link
      href={link.href}
      className={linkClass}
      aria-label={tr(`GW${gw} ${label}`, `GW${gw}: ${label}`)}
      data-journal-link={link.kind}
    >
      {label}
    </Link>
  );
}
