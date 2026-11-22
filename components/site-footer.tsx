"use client";

import Link from "next/link";
import { useLocale } from "@/components/locale-provider";
import { CONTACT_EMAIL } from "@/lib/site";

export function SiteFooter() {
  const { tr } = useLocale();

  return (
    <footer className="mt-4 w-full">
      <div className="mx-auto w-full max-w-[1440px] px-3 pb-6 pt-4 text-center text-caption leading-relaxed text-[var(--muted)]">
        <p>
          {tr(
            "FPL Live는 비공식 팬 서비스이며 Premier League 및 Fantasy Premier League와 제휴 관계가 없습니다.",
            "FPL Live is an unofficial fan project and is not affiliated with the Premier League or Fantasy Premier League."
          )}
        </p>
        <p className="mt-1 flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
          <Link href="/premier-league" className="font-semibold hover:text-[var(--accent)]">
            {tr("EPL 순위표", "EPL table")}
          </Link>
          <Link href="/fixtures" className="font-semibold hover:text-[var(--accent)]">
            {tr("경기 일정", "Fixtures")}
          </Link>
          <Link href="/players" className="font-semibold hover:text-[var(--accent)]">
            {tr("선수 통계", "Players")}
          </Link>
          <Link href="/price-changes" className="font-semibold hover:text-[var(--accent)]">
            {tr("가격 변동 예측", "Price changes")}
          </Link>
          <Link href="/faq" className="font-semibold hover:text-[var(--accent)]">
            {tr("자주 묻는 질문", "FAQ")}
          </Link>
          <Link href="/privacy" className="font-semibold hover:text-[var(--accent)]">
            {tr("개인정보처리방침", "Privacy")}
          </Link>
          <Link href="/terms" className="font-semibold hover:text-[var(--accent)]">
            {tr("이용약관", "Terms")}
          </Link>
        </p>
        <p className="mt-2">{tr(`운영: chanyong · 문의 ${CONTACT_EMAIL}`, `Run by chanyong · ${CONTACT_EMAIL}`)}</p>
      </div>
    </footer>
  );
}
