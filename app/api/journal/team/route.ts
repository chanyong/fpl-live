import { NextRequest, NextResponse } from "next/server";
import { checkEntryRequest } from "@/lib/entry-request-limit";
import { clientIp } from "@/lib/journal/rate-limit";
import { changeMemberTeam, type TeamCheck } from "@/lib/journal/service";
import { currentMember, isSameOrigin, requireStore } from "@/lib/journal/session";
import { lookupTeam } from "@/lib/journal/team-lookup";
import { teamChangeSchema } from "@/lib/journal/types";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store" };

function limitKey(headers: Headers) {
  return headers.get("x-real-ip")?.trim() || clientIp(headers);
}

/**
 * A signed-in member registers a different FPL team (issue #47): `{ teamId }`. Answers `{ ok: true }` or `{ error }` with
 * team_not_found 404, fpl_unavailable 503, team_taken 409, same_team 400, too_soon 429 (+ nextTeamChangeAt) and
 * change_failed 502. The old team's auto-saved snapshots are removed by the database function; notes stay.
 */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403, headers: NO_STORE });
  const store = requireStore();
  if (!store) return NextResponse.json({ error: "not_configured" }, { status: 503, headers: NO_STORE });
  const member = await currentMember(request, store);
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: NO_STORE });

  const parsed = teamChangeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400, headers: NO_STORE });

  const verdict = checkEntryRequest(limitKey(request.headers), parsed.data.teamId, false);
  if (!verdict.allowed) {
    return NextResponse.json(
      { error: "rate_limited", retryAfterSeconds: verdict.retryAfterSeconds },
      { status: 429, headers: { ...NO_STORE, "Retry-After": String(verdict.retryAfterSeconds) } }
    );
  }

  const result = await changeMemberTeam(store, member.user.id, parsed.data.teamId, async (teamId): Promise<TeamCheck> => {
    const team = await lookupTeam(teamId);
    return team.ok ? "found" : team.code === "team_not_found" ? "missing" : "unavailable";
  });

  if (result.ok) return NextResponse.json({ ok: true }, { headers: NO_STORE });
  if (result.code === "too_soon") {
    return NextResponse.json({ error: "too_soon", nextTeamChangeAt: result.nextChangeAt }, { status: 429, headers: NO_STORE });
  }
  const status = { same_team: 400, team_taken: 409, team_not_found: 404, fpl_unavailable: 503, change_failed: 502 }[result.code];
  return NextResponse.json({ error: result.code }, { status, headers: NO_STORE });
}
