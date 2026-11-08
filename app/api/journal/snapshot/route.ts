import { NextRequest, NextResponse } from "next/server";
import { getBootstrapStatic, getEntryHistory, getEntryPicks, getFixtures } from "@/lib/fpl-client";
import { isValidCronSecret, runSnapshotJob, type FplSource } from "@/lib/journal/service";
import { requireStore } from "@/lib/journal/session";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const source: FplSource = {
  events: async () => (await getBootstrapStatic()).events,
  history: getEntryHistory,
  picks: async (teamId, gw) =>
    (await getEntryPicks(teamId, gw)).picks.map((pick) => ({
      element: pick.element,
      position: pick.position,
      multiplier: pick.multiplier,
      isCaptain: pick.is_captain
    })),
  fixtures: async () =>
    (await getFixtures()).flatMap((fixture) =>
      fixture.event === null
        ? []
        : [{ id: fixture.id, event: fixture.event, teamH: fixture.team_h, teamA: fixture.team_a, scoreH: fixture.team_h_score, scoreA: fixture.team_a_score }]
    )
};

/** Called by the GitHub Actions cron twice a day. Protected by the JOURNAL_CRON_SECRET header. */
export async function POST(request: NextRequest) {
  if (!isValidCronSecret(request.headers.get("x-cron-secret"), process.env.JOURNAL_CRON_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const store = requireStore();
  if (!store) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  try {
    return NextResponse.json(await runSnapshotJob(store, source));
  } catch {
    return NextResponse.json({ error: "job_failed" }, { status: 500 });
  }
}
