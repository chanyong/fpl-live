"use client";

import { LeagueSearchForm } from "@/components/league-search-form";
import { LeagueIdLinks } from "@/components/league-id-links";
import Link from "next/link";
import { LocaleToggle, useLocale } from "@/components/locale-provider";

/**
 * Home, set as a matchday ticket (taste pilot). Main panel: what it is + the league ID field.
 * Stub (tear-off): the shortcut for people without a league ID.
 */
export function HomeHero() {
  const { tr } = useLocale();

  return (
    <>
      <header className="home-rise mb-5 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 md:mb-7">
        <p className="whitespace-nowrap text-body-lg font-extrabold tracking-tight text-[var(--paper)]">
          {tr("FPL 라이브", "FPL Live")}
        </p>
        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/faq"
            title={tr("자주 묻는 질문", "FAQ")}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[var(--radius)] bg-[var(--paper)] px-3.5 text-body font-semibold text-[var(--ink)] transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 4 2c-.9.6-1.5 1.1-1.5 2.2M12 17h.01" /></svg>
            <span className="sm:hidden">FAQ</span>
            <span className="hidden sm:inline">{tr("자주 묻는 질문", "FAQ")}</span>
          </Link>
          <LocaleToggle />
        </div>
      </header>

      <section className="home-ticket" aria-labelledby="home-title">
        <div className="home-ticket-main">
          <h1 id="home-title" className="home-title home-slide">
            {tr("내 미니리그 순위, 경기 중에 실시간으로", "Mini-league standings, live")}
          </h1>
          <p className="home-slide mt-4 max-w-xl text-body-lg leading-7 text-[var(--ink-soft)] md:text-lg md:leading-8">
            {tr(
              "공개 클래식 리그 ID를 입력하면 게임위크 잠정 점수, 실시간 순위 변동, 매니저별 스쿼드 현황을 볼 수 있습니다.",
              "Enter a public classic league ID to see provisional gameweek scores, live rank changes and every manager's squad."
            )}
          </p>
          <LeagueSearchForm />
          <LeagueIdLinks />
        </div>

        <aside style={{ "--i": 4 } as React.CSSProperties} className="home-rise home-ticket-stub" aria-labelledby="home-stub-title">
          <div>
            <h2 id="home-stub-title" className="text-title font-extrabold leading-snug tracking-tight">
              {tr("리그 ID 없이 바로 보기", "No league ID? Start here")}
            </h2>
            <p className="mt-2 text-body leading-6">
              {tr(
                "이번 마감 전 가격이 오를 선수와 내릴 선수를 확인하세요.",
                "See which players are about to rise or fall in price before the deadline."
              )}
            </p>
          </div>
          <Link
            href="/price-changes"
            className="home-stub-link mt-5 inline-flex min-h-11 self-start items-center rounded-[var(--radius)] bg-[var(--paper)] px-5 text-body font-semibold text-[var(--ink)] transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            {tr("가격 변동 예측 보기", "View price change predictions")}
          </Link>
        </aside>
      </section>
    </>
  );
}
