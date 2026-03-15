import { LeagueDashboard } from "@/components/league-dashboard";

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

export default async function LeaguePage({ params }: LeaguePageProps) {
  const { leagueId } = await params;
  return <LeagueDashboard leagueId={leagueId} buildId={getBuildId()} />;
}