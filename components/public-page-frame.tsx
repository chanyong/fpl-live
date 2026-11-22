"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { LocaleToggle, useLocale } from "@/components/locale-provider";
import { SiteHeader } from "@/components/site-header";

type Text = { ko: string; en: string };

/**
 * Shared shell of the pages that need no league ID: the top menu, a way into one's own league, a title and a
 * one-line explanation. Everything inside renders on the server (issue #33 stage 2).
 */
export function PublicPageFrame({ title, subtitle, children }: { title: Text; subtitle: Text; children: ReactNode }) {
  const { tr } = useLocale();

  return (
    <main className="mx-auto flex min-h-screen max-w-[1440px] flex-col gap-3 px-2 py-3 md:px-4">
      <SiteHeader>
        <LocaleToggle />
      </SiteHeader>
      <header>
        <h1 className="text-2xl font-semibold leading-tight md:text-3xl">{tr(title.ko, title.en)}</h1>
        <p className="mt-1 text-body text-[var(--muted)]">{tr(subtitle.ko, subtitle.en)}</p>
      </header>
      {children}
    </main>
  );
}

/** Shown in place of a table when FPL did not answer in time and nothing is cached. The page itself stays up. */
export function PublicDataNotice() {
  const { tr } = useLocale();

  return (
    <div
      role="status"
      className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-6 text-center text-body text-[var(--muted)]"
    >
      {tr(
        "FPL 공식 서버가 지금 응답하지 않아 데이터를 불러오지 못했습니다. 잠시 후 새로고침해 주세요.",
        "The official FPL server is not responding, so the data could not be loaded. Please refresh in a moment."
      )}
    </div>
  );
}

/** Under the panels: how to see the same thing through one's own mini-league. */
export function LeagueEntryHint() {
  const { tr } = useLocale();

  return (
    <p className="px-1 text-caption text-[var(--muted)]">
      {tr("내 미니리그 기준으로 보려면 ", "To see it through your own mini-league, ")}
      <Link href="/" className="font-semibold text-[var(--accent)] underline-offset-2 hover:underline">
        {tr("리그 ID를 입력하세요", "enter a league ID")}
      </Link>
      .
    </p>
  );
}
