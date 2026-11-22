import type { Metadata } from "next";
import { leagueViewMetadata } from "@/lib/league-page-meta";

type Props = { params: Promise<{ leagueId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { leagueId } = await params;
  return leagueViewMetadata(leagueId, "rank-change");
}

// The screen itself is drawn by the dashboard in app/league/[leagueId]/layout.tsx.
export default function Page() {
  return null;
}
