"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "@/components/locale-provider";
import { PUBLIC_MENU, PUBLIC_PAGES } from "@/lib/public-pages";

/**
 * The top menu: the pages that need no league ID (issue #33 stage 2). Plain links, so it renders on the
 * server and works without script. "home" is the light-on-dark variant for the home page.
 */
export function SiteNav({ tone = "app", className = "" }: { tone?: "app" | "home"; className?: string }) {
  const { tr } = useLocale();
  const pathname = usePathname();

  return (
    <nav aria-label={tr("주요 메뉴", "Main menu")} className={`flex flex-wrap items-center gap-x-0.5 gap-y-1 ${className}`}>
      {PUBLIC_MENU.map((key) => {
        const page = PUBLIC_PAGES[key];
        const active = pathname === page.path;
        const style =
          tone === "home"
            ? active
              ? "bg-white/20 text-[var(--paper)]"
              : "text-[var(--paper)]/80 hover:bg-white/10 hover:text-[var(--paper)]"
            : active
              ? "bg-[var(--accent-soft)] text-[var(--accent-ink)]"
              : "text-[var(--muted)] hover:text-[var(--accent)]";

        return (
          <Link
            key={key}
            href={page.path}
            aria-current={active ? "page" : undefined}
            className={`inline-flex min-h-8 items-center rounded-md px-2.5 py-1 text-caption font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${style}`}
          >
            {tr(page.label.ko, page.label.en)}
          </Link>
        );
      })}
    </nav>
  );
}
