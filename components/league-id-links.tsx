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

export function LeagueIdLinks() {
  const { tr } = useLocale();

  return (
    <div className="mt-6">
      <p className="text-sm text-[var(--muted)]">
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
              className="flex min-h-14 items-center gap-3 rounded-full border border-[var(--border)] bg-white px-5 text-sm font-medium transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
            >
              {link.icon}
              {tr(link.ko, link.en)}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
