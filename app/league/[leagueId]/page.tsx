import type { Metadata } from "next";
import { LeagueDashboard } from "@/components/league-dashboard";
import { getLeagueMeta } from "@/lib/league-meta";
import { leagueDescription, leagueTitle } from "@/lib/seo-text";
import { parseLeagueId } from "@/lib/request-params";

type LeaguePageProps = {
  params: Promise<{
    leagueId: string;
  }>;
};

function getBuildId() {
  const value =
    process.env.NEXT_PUBLIC_BUILD_ID ??
    process.env.RAILWAY_GIT_COMMIT_SHA ??
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.GITHUB_SHA ??
    "dev";

  return value.slice(0, 7);
}

/** Names the tab and any shared link after the league itself (cached, see lib/league-meta). */
export async function generateMetadata({ params }: LeaguePageProps): Promise<Metadata> {
  const { leagueId } = await params;
  const parsed = parseLeagueId(leagueId);

  if ("error" in parsed) {
    return { title: "리그를 찾을 수 없음 | FPL Live", robots: { index: false } };
  }

  const path = `/league/${parsed.leagueId}`;
  let name = `리그 ${parsed.leagueId}`;
  let gw: number | null = null;
  try {
    const meta = await getLeagueMeta(parsed.leagueId);
    name = meta.name;
    gw = meta.gw;
  } catch {
    // FPL unreachable: fall back to the id so the page still renders.
  }

  const title = leagueTitle(name, gw);
  const description = leagueDescription(name, gw);

  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { type: "website", siteName: "FPL Live", locale: "ko_KR", title, description, url: path },
    twitter: { card: "summary_large_image", title, description }
  };
}

export default async function LeaguePage({ params }: LeaguePageProps) {
  const { leagueId } = await params;
  return <LeagueDashboard leagueId={leagueId} buildId={getBuildId()} />;
}
