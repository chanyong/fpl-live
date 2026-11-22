"use client";

import Link from "next/link";
import { useLocale } from "@/components/locale-provider";

/**
 * The one way back to the home page, on every screen (issue #39 stage 1): an "F" mark plus "FPL Live".
 * It replaces the home buttons that each screen used to word differently ("다른 리그 검색",
 * "내 리그 보기", "← FPL Live"). "home" is the light-on-dark variant for the home page's dark band.
 */
export function SiteLogo({ tone = "app", className = "" }: { tone?: "app" | "home"; className?: string }) {
  const { tr } = useLocale();
  const mark =
    tone === "home" ? "bg-[var(--paper)] text-[var(--ink)]" : "bg-[var(--accent)] text-white";
  const text = tone === "home" ? "text-[var(--paper)]" : "text-[var(--text)]";

  return (
    <Link
      href="/"
      aria-label={tr("FPL Live 홈으로", "FPL Live home")}
      title={tr("홈 — 리그 ID 입력 화면", "Home — enter a league ID")}
      className={`inline-flex min-h-9 shrink-0 items-center gap-2 rounded-md pr-1 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${text} ${className}`}
    >
      <span
        aria-hidden="true"
        className={`inline-flex h-8 w-8 items-center justify-center rounded-md text-body-lg font-extrabold leading-none ${mark}`}
      >
        F
      </span>
      <span className="whitespace-nowrap text-body-lg font-extrabold tracking-tight">FPL Live</span>
    </Link>
  );
}
