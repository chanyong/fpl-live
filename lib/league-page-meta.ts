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

  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { type: "website", siteName: "FPL Live", locale: "ko_KR", title, description, url: path },
    twitter: { card: "summary_large_image", title, description }
  };
}
