import { NextRequest, NextResponse } from "next/server";
import { checkEntryRequest } from "@/lib/entry-request-limit";
import { clientIp } from "@/lib/journal/rate-limit";
import { lookupTeam } from "@/lib/journal/team-lookup";
import { parseEntryId } from "@/lib/request-params";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

/** Same per-IP key as the entry APIs: the proxy's own `x-real-ip` first, since `x-forwarded-for` can be forged. */
function limitKey(headers: Headers) {
  return headers.get("x-real-ip")?.trim() || clientIp(headers);
}

/**
 * Name and manager of one FPL team, for the "is this your team?" step of sign-up and of a team change (issue #47).
 * No login (the sign-up form needs it) and nothing but what FPL publishes. `?teamId=`
 * Uses the per-IP brake of the entry APIs and a short in-memory cache, so it adds no FPL call for a repeated number.
 */
export async function GET(request: NextRequest) {
  const parsed = parseEntryId(request.nextUrl.searchParams.get("teamId"));
  if ("error" in parsed) return NextResponse.json({ error: "invalid_input" }, { status: 400, headers: NO_STORE });

  const verdict = checkEntryRequest(limitKey(request.headers), parsed.entryId, false);
  if (!verdict.allowed) {
    return NextResponse.json(
      { error: "rate_limited", retryAfterSeconds: verdict.retryAfterSeconds },
      { status: 429, headers: { ...NO_STORE, "Retry-After": String(verdict.retryAfterSeconds) } }
    );
  }

  const team = await lookupTeam(parsed.entryId);
  if (!team.ok) {
    return NextResponse.json({ error: team.code }, { status: team.code === "team_not_found" ? 404 : 503, headers: NO_STORE });
  }
  return NextResponse.json({ teamId: team.teamId, teamName: team.teamName, managerName: team.managerName }, { headers: NO_STORE });
}
