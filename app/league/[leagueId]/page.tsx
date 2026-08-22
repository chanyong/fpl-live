import type { Metadata } from "next";
import { LeagueDashboard } from "@/components/league-dashboard";
import { getStandingsPage } from "@/lib/fpl-client";
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

/** Names the tab and any shared link after the league itself. */
export async function generateMetadata({ params }: LeaguePageProps): Promise<Metadata> {
  const { leagueId } = await params;
  const parsed = parseLeagueId(leagueId);

  if ("error" in parsed) {
    return { title: "리그를 찾을 수 없음 · FPL Live" };
  }

  try {
    // First page only — the league name is all this needs.
    const page = await getStandingsPage(parsed.leagueId, 1);
    return {
      title: `${page.league.name} · FPL Live`,
      description: `${page.league.name} 미니리그의 라이브 순위와 게임위크 잠정 점수.`
    };
  } catch {
    return { title: `리그 ${parsed.leagueId} · FPL Live` };
  }
}

export default async function LeaguePage({ params }: LeaguePageProps) {
  const { leagueId } = await params;
  return <LeagueDashboard leagueId={leagueId} buildId={getBuildId()} />;
}
