import { NextRequest, NextResponse } from "next/server";
import { getBootstrapStatic, getEntryHistory, getEntryPicks, getEventLive, getFixtures } from "@/lib/fpl-client";
import { parseBackfillParams } from "@/lib/journal/backfill-params";
import { isValidCronSecret, runSnapshotBackfill, runSnapshotJob, type FplSource } from "@/lib/journal/service";
import { requireStore } from "@/lib/journal/session";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** One source per request, so bootstrap-static is fetched once even though events and catalog both need it. */
function createSource(): FplSource {
  let bootstrap: ReturnType<typeof getBootstrapStatic> | null = null;
  const getBootstrap = () => (bootstrap ??= getBootstrapStatic());
  return {
  events: async () => (await getBootstrap()).events,
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
    const data = await getBootstrap();
    return {
      players: data.elements.map((element) => ({ id: element.id, name: element.web_name, team: element.team, type: element.element_type })),
      teams: data.teams.map((team) => ({ id: team.id, short: team.short_name }))
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
}

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
      // A bad gws/limit must stop the request: silently dropping it would widen a staged write to everything.
      const parsed = parseBackfillParams(params);
      if (!parsed.ok) return NextResponse.json({ error: "invalid_params", param: parsed.param }, { status: 400 });
      return NextResponse.json(await runSnapshotBackfill(store, createSource(), parsed.options));
    }
    return NextResponse.json(await runSnapshotJob(store, createSource()));
  } catch {
    return NextResponse.json({ error: "job_failed" }, { status: 500 });
  }
}
