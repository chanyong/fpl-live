"use client";

import type { ReactNode } from "react";
import { useLocale } from "@/components/locale-provider";

type LinkItem = {
  href: string;
  ko: string;
  en: string;
  icon: ReactNode;
};

const iconClass = "h-6 w-6";

const LINKS: LinkItem[] = [
  {
    href: "https://fantasy.premierleague.com/leagues",
    ko: "FPL 공식 홈페이지",
    en: "FPL website",
    icon: (
      <svg viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9S14.5 18.4 12 21c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" />
      </svg>
    ),
  },
  {
    href: "https://play.google.com/store/apps/details?id=com.pl.premierleague",
    ko: "구글 EPL App",
    en: "Google Play app",
    icon: (
      <svg viewBox="0 0 24 24" className={iconClass} fill="currentColor" aria-hidden="true">
        <path d="M4.5 2.7v18.6c0 .4.4.6.7.4l15-9.3c.3-.2.3-.6 0-.8L5.2 2.3c-.3-.2-.7 0-.7.4z" />
      </svg>
    ),
  },
  {
    href: "https://apps.apple.com/app/id1138895159",
    ko: "애플 EPL App",
    en: "App Store app",
    icon: (
      <svg viewBox="0 0 24 24" className={iconClass} fill="currentColor" aria-hidden="true">
        <path d="M16.4 12.8c0-2.4 2-3.5 2-3.6-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.9-3.5.9s-1.8-.8-3-.8c-1.5 0-3 .9-3.800 2.300-1.600 2.800-.4 7 1.200 9.300.8 1.100 1.700 2.400 2.900 2.300 1.200 0 1.600-.7 3-.7s1.800.7 3 .7 2-1.100 2.800-2.300c.9-1.300 1.200-2.500 1.300-2.600-.1 0-2.500-1-2.500-3.700zM14.100 5.700c.6-.8 1.100-1.900.9-3-.9 0-2.100.6-2.700 1.400-.6.700-1.100 1.800-1 2.900 1.100.1 2.200-.5 2.800-1.300z" />
      </svg>
    ),
  },
];

// Renders only inside .home-stage (app/page.tsx): its colours and radius come from the home tokens there.
export function LeagueIdLinks() {
  const { tr } = useLocale();

  return (
    <div className="mt-6">
      <p className="text-body text-[var(--ink-soft)]">
        {tr(
          "리그 ID가 기억나지 않나요? FPL 홈페이지나 App에서 내 리그 주소의 숫자를 확인하세요.",
          "Not sure of your league ID? Open FPL on the web or in the app and read the number in your league's address."
        )}
      </p>
      <ul className="mt-3 flex flex-wrap gap-3">
        {LINKS.map((link) => (
          <li key={link.href}>
            <a
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-12 items-center gap-3 rounded-[var(--radius)] bg-[var(--paper-tone)] px-5 text-body font-medium transition hover:bg-[var(--paper-tone-hover)]"
            >
              {link.icon}
              {tr(link.ko, link.en)}
            </a>
          </li>
        ))}
      </ul>
      <LeagueIdGuide />
    </div>
  );
}

/** Step-by-step "where is my league ID", with a drawn address bar instead of a screenshot. */
function LeagueIdGuide() {
  const { tr } = useLocale();

  return (
    <details className="group mt-4 overflow-hidden rounded-[var(--radius)] bg-[var(--paper-tone)]">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-body font-semibold [&::-webkit-details-marker]:hidden">
        <span className="grid h-5 w-5 place-items-center rounded-full bg-[var(--stub)] text-caption text-white">?</span>
        <span className="flex-1">{tr("리그 ID 찾는 법", "How to find your league ID")}</span>
        <span aria-hidden className="text-[var(--ink-soft)] transition-transform group-open:rotate-180">▾</span>
      </summary>
      <div className="grid gap-4 bg-white/60 px-4 py-4 text-body leading-6 md:grid-cols-2">
        <div className="min-w-0">
          <p className="font-semibold">{tr("PC·모바일 웹", "On the web")}</p>
          <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-[var(--ink-soft)]">
            <li>{tr("fantasy.premierleague.com 에 로그인합니다.", "Log in at fantasy.premierleague.com.")}</li>
            <li>{tr("위쪽 메뉴에서 ‘Leagues & Cups’를 누릅니다.", "Open ‘Leagues & Cups’ from the top menu.")}</li>
            <li>{tr("보고 싶은 클래식 리그 이름을 누릅니다.", "Click the classic league you want.")}</li>
            <li>{tr("주소창의 leagues/ 뒤 숫자가 리그 ID입니다.", "The number after leagues/ in the address is the ID.")}</li>
          </ol>
          <div className="mt-2 overflow-hidden rounded-[var(--radius)] bg-white" aria-hidden="true">
            <div className="flex items-center gap-1.5 bg-[var(--paper-tone)] px-3 py-1.5">
              <span className="h-2 w-2 rounded-full bg-red-300" />
              <span className="h-2 w-2 rounded-full bg-amber-300" />
              <span className="h-2 w-2 rounded-full bg-emerald-300" />
            </div>
            <div className="break-all px-3 py-2 text-caption tabular-nums text-[var(--ink-soft)]">
              fantasy.premierleague.com/leagues/
              <mark className="rounded bg-[var(--stub)] px-1 font-bold text-white">915874</mark>
              /standings/c
            </div>
          </div>
        </div>
        <div className="min-w-0">
          <p className="font-semibold">{tr("Premier League 앱", "In the Premier League app")}</p>
          <p className="mt-1 text-[var(--ink-soft)]">
            {tr(
              "앱 화면에는 리그 ID 숫자가 잘 보이지 않습니다. 앱의 초대 링크(…/auto-join/영문코드)는 리그 ID가 아닙니다. 휴대폰 브라우저로 fantasy.premierleague.com 에 로그인해 ‘PC·모바일 웹’ 방법으로 주소의 숫자를 확인하세요.",
              "The app rarely shows the numeric ID, and its invite link (…/auto-join/code) is not the league ID. Log in at fantasy.premierleague.com in your phone's browser and follow the web steps."
            )}
          </p>
          <p className="mt-2 rounded-[var(--radius)] bg-amber-100 px-3 py-2 text-caption text-amber-900">
            {tr(
              "bfwf45 처럼 영문이 섞인 초대 코드는 리그 ID가 아닙니다. 숫자만 넣어 주세요. 한 번 연 리그는 이 브라우저의 ‘최근 본 리그’에 남습니다.",
              "Invite codes with letters (like bfwf45) are not league IDs — use the number only. Leagues you open are kept under ‘Recent leagues’ in this browser."
            )}
          </p>
        </div>
      </div>
    </details>
  );
}
