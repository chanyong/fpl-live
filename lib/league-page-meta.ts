import type { Metadata } from "next";
import { getLeagueMeta } from "@/lib/league-meta";
import { leagueViewPath, type LeagueView } from "@/lib/league-views";
import { parseLeagueId } from "@/lib/request-params";
import { leagueViewDescription, leagueViewTitle } from "@/lib/seo-text";

/**
 * Title, description, canonical and share card for one dashboard screen. Names the tab and any shared
 * link after the league itself (cached, see lib/league-meta). Each screen has its own address, so each
 * gets its own canonical.
 */
export async function leagueViewMetadata(rawLeagueId: string, view: LeagueView): Promise<Metadata> {
  const parsed = parseLeagueId(rawLeagueId);

  if ("error" in parsed) {
    return { title: "리그를 찾을 수 없음 | FPL Live", robots: { index: false } };
  }

  const path = leagueViewPath(parsed.leagueId, view);
  let name = `리그 ${parsed.leagueId}`;
  let gw: number | null = null;
  try {
    const meta = await getLeagueMeta(parsed.leagueId);
    name = meta.name;
    gw = meta.gw;
  } catch {
    // FPL unreachable: fall back to the id so the page still renders.
  }

  const title = leagueViewTitle(name, gw, view);
  const description = leagueViewDescription(name, gw, view);

  // The share card image is a file route on /league/ID only; Next does not carry it down to the tab
  // addresses once they set their own openGraph, so those name it here.
  const images =
    view === "fixtures"
      ? undefined
      : [{ url: `/league/${parsed.leagueId}/opengraph-image`, width: 1200, height: 630, alt: "FPL Live 미니리그 실시간 순위" }];

  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { type: "website", siteName: "FPL Live", locale: "ko_KR", title, description, url: path, images },
    twitter: { card: "summary_large_image", title, description, images }
  };
}
