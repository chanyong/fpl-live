import { LeagueDashboard } from "@/components/league-dashboard";

type LeaguePageProps = {
  params: Promise<{
    leagueId: string;
  }>;
};

export default async function LeaguePage({ params }: LeaguePageProps) {
  const { leagueId } = await params;
  return <LeagueDashboard leagueId={leagueId} />;
}
