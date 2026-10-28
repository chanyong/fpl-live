"use client";

import Link from "next/link";
import { useLocale } from "@/components/locale-provider";
import { FEEDBACK_URL } from "@/lib/site";

export function SiteFooter() {
  const { tr } = useLocale();

  return (
    <footer className="mx-auto mt-4 w-full max-w-[1440px] px-3 pb-6 text-center text-[12px] leading-relaxed text-[var(--muted)]">
      <p>
        {tr(
          "FPL Live는 비공식 팬 서비스이며 Premier League 및 Fantasy Premier League와 제휴 관계가 없습니다.",
          "FPL Live is an unofficial fan project and is not affiliated with the Premier League or Fantasy Premier League."
        )}
      </p>
      <p className="mt-1 flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
        <Link href="/price-changes" className="font-semibold hover:text-[var(--accent)]">
          {tr("가격 변동 예측", "Price changes")}
        </Link>
        <Link href="/faq" className="font-semibold hover:text-[var(--accent)]">
          {tr("자주 묻는 질문", "FAQ")}
        </Link>
        <a href={FEEDBACK_URL} target="_blank" rel="noreferrer" className="font-semibold hover:text-[var(--accent)]">
          {tr("피드백 · 버그 제보", "Feedback & bug reports")}
        </a>
      </p>
    </footer>
  );
}
