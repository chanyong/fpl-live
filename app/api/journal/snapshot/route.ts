import { NextRequest, NextResponse } from "next/server";
import { getBootstrapStatic, getEntryHistory, getEntryPicks, getEventLive, getFixtures } from "@/lib/fpl-client";
import { isValidCronSecret, runSnapshotBackfill, runSnapshotJob, type FplSource } from "@/lib/journal/service";
import { requireStore } from "@/lib/journal/session";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const source: FplSource = {
  events: async () => (await getBootstrapStatic()).events,
  history: getEntryHistory,
  picks: async (teamId, gw) => {
    const data = await getEntryPicks(teamId, gw);
    return {
      picks: data.picks.map((pick) => ({
        element: pick.element,
        position: pick.position,
        multiplier: pick.multiplier,
        isCaptain: pick.is_captain,
        isVice: pick.is_vice_captain
      })),
      autoSubs: data.automatic_subs.map((sub) => ({ in: sub.element_in, out: sub.element_out }))
    };
  },
  fixtures: async () =>
    (await getFixtures()).flatMap((fixture) =>
      fixture.event === null
        ? []
        : [
            {
              id: fixture.id,
              event: fixture.event,
              teamH: fixture.team_h,
              teamA: fixture.team_a,
              scoreH: fixture.team_h_score,
              scoreA: fixture.team_a_score,
              kickoff: fixture.kickoff_time,
              finished: fixture.finished || fixture.finished_provisional
            }
          ]
    ),
  catalog: async () => {
    const bootstrap = await getBootstrapStatic();
    return {
      players: bootstrap.elements.map((element) => ({ id: element.id, name: element.web_name, team: element.team, type: element.element_type })),
      teams: bootstrap.teams.map((team) => ({ id: team.id, short: team.short_name }))
    };
  },
  live: async (gw) =>
    (await getEventLive(gw)).elements.map((element) => ({
      id: element.id,
      points: element.stats.total_points,
      minutes: element.stats.minutes,
      explain: element.explain.map((entry) => ({
        fixture: entry.fixture,
        stats: entry.stats.map((stat) => ({ id: stat.identifier, value: stat.value, points: stat.points + stat.points_modification }))
      }))
    }))
};

/**
 * Called by the GitHub Actions cron twice a day. Protected by the JOURNAL_CRON_SECRET header.
 *
 * `?mode=backfill` re-fills snapshots saved before issue #27 with the player ledger and results.
 * It is a dry run (reports only) unless `&write=1` is also given. Optional `&gws=1,2` and `&limit=N`.
 */
export async function POST(request: NextRequest) {
  if (!isValidCronSecret(request.headers.get("x-cron-secret"), process.env.JOURNAL_CRON_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const store = requireStore();
  if (!store) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  try {
    const params = request.nextUrl.searchParams;
    if (params.get("mode") === "backfill") {
      const gws = params
        .get("gws")
        ?.split(",")
        .map(Number)
        .filter((value) => Number.isInteger(value) && value >= 1 && value <= 38);
      const limit = Number(params.get("limit"));
      return NextResponse.json(
        await runSnapshotBackfill(store, source, {
          write: params.get("write") === "1",
          gws: gws && gws.length > 0 ? gws : undefined,
          limit: Number.isInteger(limit) && limit > 0 ? limit : undefined
        })
      );
    }
    return NextResponse.json(await runSnapshotJob(store, source));
  } catch {
    return NextResponse.json({ error: "job_failed" }, { status: 500 });
  }
}
