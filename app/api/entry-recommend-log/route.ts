import { NextRequest, NextResponse } from "next/server";
import { isAllowedEntry } from "@/lib/ai/allowed-entry";
import { loadRecommendationLog } from "@/lib/ai/log-runtime";
import type { RecommendLogResponse } from "@/lib/ai/rec-log";
import { checkEntryRequest } from "@/lib/entry-request-limit";
import { checkOwnTeam, ownTeamRefusal } from "@/lib/journal/own-team";
import { clientIp } from "@/lib/journal/rate-limit";
import { parseEntryId } from "@/lib/request-params";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE = { "Cache-Control": "no-store" };

function limitKey(headers: Headers) {
  return headers.get("x-real-ip")?.trim() || clientIp(headers);
}

/**
 * The recommendation log of one team (issue #43, stage 5): the last 10 recorded gameweeks, newest first, each
 * with the real result once the gameweek is finished. Only the allowed team has a log; every other team ID gets
 * an empty list (200) and no database access. Members only, for the member's own registered team (issue #47): no session
 * answers 401 login_required, another team's ID 403 not_your_team; both come before the allowed-team check. A log that cannot be read is also an empty list: this is a
 * reference record, never an error screen.
 */
export async function GET(request: NextRequest) {
  const parsed = parseEntryId(request.nextUrl.searchParams.get("entryId"));
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400, headers: NO_STORE });
  }

  const refusal = ownTeamRefusal(await checkOwnTeam(request, parsed.entryId));
  if (refusal) return refusal;

  const empty: RecommendLogResponse = { entries: [] };
  if (!isAllowedEntry(parsed.entryId)) {
    return NextResponse.json(empty, { headers: NO_STORE });
  }

  // Same per-IP brake as the other entry APIs.
  const verdict = checkEntryRequest(limitKey(request.headers), parsed.entryId, false);
  if (!verdict.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again shortly.", retryAfterSeconds: verdict.retryAfterSeconds },
      { status: 429, headers: { ...NO_STORE, "Retry-After": String(verdict.retryAfterSeconds) } }
    );
  }

  try {
    const entries = await loadRecommendationLog(parsed.entryId);
    return NextResponse.json({ entries } satisfies RecommendLogResponse, { headers: NO_STORE });
  } catch {
    return NextResponse.json(empty, { headers: NO_STORE });
  }
}
