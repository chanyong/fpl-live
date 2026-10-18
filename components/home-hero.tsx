"use client";

import { LeagueSearchForm } from "@/components/league-search-form";
import { LocaleToggle, useLocale } from "@/components/locale-provider";

export function HomeHero() {
  const { tr } = useLocale();

  return (
    <section className="rounded-[2rem] border border-[var(--border)] bg-[var(--surface)]/95 p-6 shadow-[0_20px_80px_rgba(55,40,20,0.12)] md:p-8">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm uppercase tracking-[0.3em] text-[var(--muted)]">
          {tr("공식 FPL 라이브 대시보드", "Official FPL live dashboard")}
        </p>
        <LocaleToggle />
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
    </section>
  );
}
