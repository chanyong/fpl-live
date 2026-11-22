"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useLocale } from "@/components/locale-provider";
import { CalendarIcon, PlayerIcon, PriceChangeIcon, ShirtIcon, TableIcon, TrophyIcon } from "@/components/icons";
import { loadRecentLeagues } from "@/lib/recent-leagues";
import { PUBLIC_MENU, PUBLIC_PAGES, type PublicPageKey } from "@/lib/public-pages";

const MENU_ICONS: Record<PublicPageKey, (props: { className?: string }) => React.JSX.Element> = {
  "premier-league": TableIcon,
  fixtures: CalendarIcon,
  players: PlayerIcon,
  "price-changes": PriceChangeIcon
};

/** "My team" (issue #39 stage 2): /team opens the team remembered in this browser, or asks for a team ID. */
const MY_TEAM_PATH = "/team";

/**
 * "My league" (issue #39): the league being viewed, else the one opened most recently in this browser
 * (the same "recent leagues" list the home page shows), else the home page where a league is searched.
 */
const LEAGUE_PATH = /^\/league\/(\d+)(?:\/|$)/;

/**
 * The top menu: the pages that need no league ID (issue #33 stage 2) and the squad screen. Plain links, so it
 * renders on the server and works without script. "home" is the light-on-dark variant for the home page.
 */
export function SiteNav({ tone = "app", className = "" }: { tone?: "app" | "home"; className?: string }) {
  const { tr } = useLocale();
  const pathname = usePathname() ?? "";
  // Storage is read after mount, so the server render and the first client render both point home.
  const [recentLeagueId, setRecentLeagueId] = useState<number | null>(null);
  useEffect(() => {
    setRecentLeagueId(loadRecentLeagues()[0]?.id ?? null);
  }, []);
  const viewedLeague = LEAGUE_PATH.exec(pathname);
  const leagueId = viewedLeague ? Number(viewedLeague[1]) : recentLeagueId;
  const leagueHref = leagueId ? `/league/${leagueId}` : "/";

  const itemStyle = (active: boolean) =>
    tone === "home"
      ? active
        ? "bg-white/20 text-[var(--paper)]"
        : "text-[var(--paper)]/80 hover:bg-white/10 hover:text-[var(--paper)]"
      : active
        ? "bg-[var(--accent-soft)] text-[var(--accent-ink)]"
        : "text-[var(--muted)] hover:text-[var(--accent)]";
  const itemClass = (active: boolean) =>
    `flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-md px-1.5 py-1 text-center text-caption font-semibold leading-tight sm:min-h-9 sm:flex-row sm:gap-1.5 sm:px-2.5 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${itemStyle(active)}`;
  const myTeamActive = pathname === MY_TEAM_PATH || pathname.startsWith(`${MY_TEAM_PATH}/`);

  return (
    <nav aria-label={tr("주요 메뉴", "Main menu")} className={`grid grid-cols-6 gap-1 sm:flex sm:flex-wrap sm:items-center sm:gap-x-0.5 ${className}`}>
      {PUBLIC_MENU.map((key) => {
        const page = PUBLIC_PAGES[key];
        const Icon = MENU_ICONS[key];
        const active = pathname === page.path;
        return (
          <Link
            key={key}
            href={page.path}
            aria-current={active ? "page" : undefined}
            className={itemClass(active)}
          >
            <Icon className="shrink-0" />
            <span>{tr(page.label.ko, page.label.en)}</span>
          </Link>
        );
      })}
      <Link href={leagueHref} aria-current={viewedLeague ? "page" : undefined} className={itemClass(viewedLeague !== null)}>
        <TrophyIcon className="shrink-0" />
        <span>{tr("내 리그", "My league")}</span>
      </Link>
      <Link href={MY_TEAM_PATH} aria-current={myTeamActive ? "page" : undefined} className={itemClass(myTeamActive)}>
        <ShirtIcon className="shrink-0" />
        <span>{tr("내 팀", "My team")}</span>
      </Link>
    </nav>
  );
}
