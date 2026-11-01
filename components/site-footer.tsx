"use client";

import Link from "next/link";
import { useLocale } from "@/components/locale-provider";
import { NETWORK_SITES, networkHref } from "@/lib/network";

export function SiteFooter() {
  const { tr } = useLocale();

  return (
    <footer className="mt-4 w-full">
      {/* 운영자의 다른 서비스: 전 사이트 공통 카드 띠(chanyong/ddalkkak-rank#12). 법적 고지 위, 테두리·배경으로 분리.
          서버에서 그려지는 정적 <a> 그대로 둔다(JS로 만들지 않는다). */}
      <nav
        aria-label={tr("운영자의 다른 서비스", "More from the operator")}
        className="border-y border-[var(--border)] bg-[var(--surface-strong)] py-8 text-[var(--text)]"
      >
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="mb-4 text-title font-bold">{tr("운영자의 다른 서비스", "More from the operator")}</h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {NETWORK_SITES.map((service) => (
              <li key={service.url}>
                <a
                  href={networkHref(service.url)}
                  target="_blank"
                  rel="noopener"
                  className="flex h-full items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-[var(--text)] transition hover:-translate-y-0.5 hover:border-[var(--accent)] hover:shadow-md focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
                >
                  <span aria-hidden="true" className="w-8 shrink-0 text-center text-2xl leading-none">
                    {service.icon}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-body-lg font-bold leading-snug">{tr(service.name, service.en)}</span>
                    <span className="block text-meta text-[var(--muted)]">{tr(service.desc, service.descEn)}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </nav>
      <div className="mx-auto w-full max-w-[1440px] px-3 pb-6 pt-4 text-center text-caption leading-relaxed text-[var(--muted)]">
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
          <Link href="/privacy" className="font-semibold hover:text-[var(--accent)]">
            {tr("개인정보처리방침", "Privacy")}
          </Link>
          <Link href="/terms" className="font-semibold hover:text-[var(--accent)]">
            {tr("이용약관", "Terms")}
          </Link>
        </p>
        <p className="mt-2">{tr("운영: chanyong · 문의 cyjung@gmail.com", "Run by chanyong · cyjung@gmail.com")}</p>
      </div>
    </footer>
  );
}
