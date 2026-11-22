import type { ReactNode } from "react";
import { LeagueDashboard } from "@/components/league-dashboard";

type LeagueLayoutProps = {
  children: ReactNode;
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

/**
 * The dashboard lives in the layout, not in each tab's page: a layout stays mounted while the tab (the
 * address below /league/ID) changes, so switching tabs is a client-side navigation that keeps the
 * react-query cache, the 30s refresh and the rival choice (issue #33). The pages only supply per-tab metadata.
 */
export default async function LeagueLayout({ children, params }: LeagueLayoutProps) {
  const { leagueId } = await params;
  return (
    <>
      <LeagueDashboard leagueId={leagueId} buildId={getBuildId()} />
      {children}
    </>
  );
}
