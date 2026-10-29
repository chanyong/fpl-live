"use client";

import Link from "next/link";
import { useLocale } from "@/components/locale-provider";
import { FEEDBACK_URL } from "@/lib/site";

const OTHER_SERVICES = [
  { name: "딸깍랭크", en: "DdalkkakRank", href: "https://ddalkkakrank.kr", desc: "AI 웹서비스 랭킹", descEn: "AI web service ranking" },
  { name: "에어모아", en: "Airmoa", href: "https://www.airmoa.kr", desc: "항공권 특가 모음", descEn: "Airfare deals" },
  { name: "내여행 찾아줌", en: "ZoomMyTrip", href: "https://zoommytrip.kr", desc: "마일리지 좌석", descEn: "Award seats" },
  { name: "이때다", en: "Ittaeda", href: "https://ittaeda.com", desc: "호텔 날짜별 가격", descEn: "Hotel prices by date" },
  { name: "숲가자", en: "Supgaja", href: "https://supgaja.com", desc: "자연휴양림 빈자리", descEn: "Forest lodge vacancies" },
  { name: "ETFX", en: "ETFX", href: "https://etfx.kr", desc: "ETF 구성종목 분석", descEn: "ETF holdings" },
  { name: "카드매치", en: "CardMatch", href: "https://cardmatch.kr", desc: "카드 추천", descEn: "Card picker" },
  { name: "내 압구정", en: "My Apgujeong", href: "https://myapgujeong.kr", desc: "아파트 실거래", descEn: "Apartment deals" },
  { name: "입시on", en: "Ipsion", href: "https://www.ipsion.kr", desc: "대입 경쟁률", descEn: "Admission rates" },
  { name: "자동차보험 환급 비교", en: "Car insurance refunds", href: "https://auto-insu-compare.vercel.app", desc: "보험 환급 비교", descEn: "Refund comparison" }
];

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
        <Link href="/privacy" className="font-semibold hover:text-[var(--accent)]">
          {tr("개인정보처리방침", "Privacy")}
        </Link>
        <Link href="/terms" className="font-semibold hover:text-[var(--accent)]">
          {tr("이용약관", "Terms")}
        </Link>
      </p>
      <nav aria-label={tr("운영자의 다른 서비스", "More from the operator")} className="mt-3">
        <p className="font-semibold">{tr("운영자의 다른 서비스", "More from the operator")}</p>
        <ul className="mt-1 flex flex-wrap justify-center gap-x-3 gap-y-1">
          {OTHER_SERVICES.map((service) => (
            <li key={service.href}>
              <a href={service.href} target="_blank" rel="noopener" className="hover:text-[var(--accent)]">
                <b className="font-semibold">{tr(service.name, service.en)}</b> {tr(service.desc, service.descEn)}
              </a>
            </li>
          ))}
        </ul>
        <p className="mt-2">{tr("운영: chanyong · 문의 cyjung@gmail.com", "Run by chanyong · cyjung@gmail.com")}</p>
      </nav>
    </footer>
  );
}
