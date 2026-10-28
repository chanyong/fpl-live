"use client";

import { LeagueSearchForm } from "@/components/league-search-form";
import { LeagueIdLinks } from "@/components/league-id-links";
import Link from "next/link";
import { LocaleToggle, useLocale } from "@/components/locale-provider";

export function HomeHero() {
  const { tr } = useLocale();

  return (
    <section className="rounded-[2rem] border border-[var(--border)] bg-[var(--surface)]/95 p-6 shadow-[0_20px_80px_rgba(55,40,20,0.12)] md:p-8">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm uppercase tracking-[0.3em] text-[var(--muted)]">
          {tr("공식 FPL 라이브 대시보드", "Official FPL live dashboard")}
        </p>
        <div className="flex items-center gap-2">
          <Link
            href="/faq"
            aria-label={tr("자주 묻는 질문", "FAQ")}
            title={tr("자주 묻는 질문", "FAQ")}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-sm font-bold text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            ?
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
