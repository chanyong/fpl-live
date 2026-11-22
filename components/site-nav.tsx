"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "@/components/locale-provider";
import { CalendarIcon, PlayerIcon, PriceChangeIcon, TableIcon } from "@/components/icons";
import { PUBLIC_MENU, PUBLIC_PAGES, type PublicPageKey } from "@/lib/public-pages";

const MENU_ICONS: Record<PublicPageKey, (props: { className?: string }) => React.JSX.Element> = {
  "premier-league": TableIcon,
  fixtures: CalendarIcon,
  players: PlayerIcon,
  "price-changes": PriceChangeIcon
};

/**
 * The top menu: the pages that need no league ID (issue #33 stage 2). Plain links, so it renders on the
 * server and works without script. "home" is the light-on-dark variant for the home page.
 */
export function SiteNav({ tone = "app", className = "" }: { tone?: "app" | "home"; className?: string }) {
  const { tr } = useLocale();
  const pathname = usePathname();

  return (
    <nav aria-label={tr("주요 메뉴", "Main menu")} className={`grid grid-cols-4 gap-1 sm:flex sm:flex-wrap sm:items-center sm:gap-x-0.5 ${className}`}>
      {PUBLIC_MENU.map((key) => {
        const page = PUBLIC_PAGES[key];
        const Icon = MENU_ICONS[key];
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
            className={`flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-md px-1.5 py-1 text-center text-caption font-semibold leading-tight sm:min-h-9 sm:flex-row sm:gap-1.5 sm:px-2.5 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${style}`}
          >
            <Icon className="shrink-0" />
            <span>{tr(page.label.ko, page.label.en)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
