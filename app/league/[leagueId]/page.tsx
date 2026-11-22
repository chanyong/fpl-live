import type { Metadata } from "next";
import { leagueViewMetadata } from "@/lib/league-page-meta";

type Props = { params: Promise<{ leagueId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { leagueId } = await params;
  return leagueViewMetadata(leagueId, "fixtures");
}

// The screen itself is drawn by the dashboard in ./layout.tsx.
export default function LeaguePage() {
  return null;
}
