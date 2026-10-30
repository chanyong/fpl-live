"use client";

import { LeagueSearchForm } from "@/components/league-search-form";
import { LeagueIdLinks } from "@/components/league-id-links";
import Link from "next/link";
import { LocaleToggle, useLocale } from "@/components/locale-provider";

export function HomeHero() {
  const { tr } = useLocale();

  return (
    <section className="rounded-[2rem] border border-[var(--border)] bg-[var(--surface)]/95 p-6 shadow-[0_20px_80px_rgba(55,40,20,0.12)] md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <p className="whitespace-nowrap text-xs font-medium text-[var(--muted)] sm:text-sm">
          {tr("FPL 라이브 대시보드", "FPL live dashboard")}
        </p>
        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/faq"
            title={tr("자주 묻는 질문", "FAQ")}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-[var(--accent)] px-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--accent-ink)]"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 4 2c-.9.6-1.5 1.1-1.5 2.2M12 17h.01" /></svg>
            <span className="sm:hidden">FAQ</span>
            <span className="hidden sm:inline">{tr("자주 묻는 질문", "FAQ")}</span>
          </Link>
          <LocaleToggle />
        </div>
      </div>
      <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight md:text-5xl">
        {tr("경기가 진행되는 동안 미니리그 순위를 따라가세요.", "Follow your mini-league standings while the matches are on.")}
      </h1>
      <p className="mt-4 max-w-2xl text-lg leading-8 text-[var(--muted)]">
        {tr(
          "공개 클래식 리그 ID를 입력하면 게임위크 잠정 점수, 실시간 순위 변동, 매니저별 스쿼드 현황을 볼 수 있습니다.",
          "Enter a public classic league ID to see provisional gameweek scores, live rank changes and every manager's squad."
        )}
      </p>
      <LeagueSearchForm />
      <LeagueIdLinks />
      <div className="mt-6 rounded-2xl border border-[var(--info-border)] bg-[var(--info-soft)] p-4 text-sm">
        <p className="font-semibold text-[var(--info)]">
          {tr("리그 ID 없이 바로 보기", "No league ID? Start here")}
        </p>
        <p className="mt-1 text-[var(--muted)]">
          {tr(
            "이번 마감 전 가격이 오를 선수와 내릴 선수를 확인하세요.",
            "See which players are about to rise or fall in price before the deadline."
          )}
        </p>
        <Link
          href="/price-changes"
          className="mt-3 inline-flex rounded-full border border-[var(--info)] bg-white px-4 py-1.5 text-[13px] font-semibold text-[var(--info)] transition hover:bg-[var(--info-soft)]"
        >
          {tr("가격 변동 예측 보기", "View price change predictions")}
        </Link>
      </div>
    </section>
  );
}
