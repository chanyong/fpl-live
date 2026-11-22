import { NextRequest, NextResponse } from "next/server";
import { isAllowedEntry } from "@/lib/ai/allowed-entry";
import { recordInBackground } from "@/lib/ai/log-runtime";
import { checkEntryRequest } from "@/lib/entry-request-limit";
import { checkOwnTeam, ownTeamRefusal } from "@/lib/journal/own-team";
import { clientIp } from "@/lib/journal/rate-limit";
import { parseEntryId } from "@/lib/request-params";
import { EntryBusyError, EntryNotFoundError, FplUnavailableError, getEntryRecommend } from "@/lib/xp/recommend";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE = { "Cache-Control": "no-store" };

/** Same per-IP key as /api/entry-squad: the proxy's own `x-real-ip` first, since `x-forwarded-for` can be forged. */
function limitKey(headers: Headers) {
  return headers.get("x-real-ip")?.trim() || clientIp(headers);
}

/**
 * Rule-based lineup, captain and transfer-scenario candidates for one team (issue #43, stages 1-A and 1-B):
 * expected points from the public FPL data, no AI. Members only, and only for the team registered on the member's own
 * account (issue #47): no session answers 401 login_required, another team's ID 403 not_your_team. Nothing is stored except,
 * for the allowed team only, the best-effort recommendation log (lib/ai/rec-log). `horizon=3|5` is the number of
 * gameweeks the transfer scenarios add up (default 3). It reads what /api/entry-squad reads (getEntrySquad) plus
 * the shared xP table, so it adds no FPL call.
 */
export async function GET(request: NextRequest) {
  const parsed = parseEntryId(request.nextUrl.searchParams.get("entryId"));
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400, headers: NO_STORE });
  }

  const horizonParam = request.nextUrl.searchParams.get("horizon");
  if (horizonParam !== null && horizonParam !== "3" && horizonParam !== "5") {
    return NextResponse.json({ error: "horizon must be 3 or 5" }, { status: 400, headers: NO_STORE });
  }
  const horizon = horizonParam === "5" ? 5 : 3;

  // The own-team check comes before the per-IP brake and before any FPL work.
  const refusal = ownTeamRefusal(await checkOwnTeam(request, parsed.entryId));
  if (refusal) return refusal;

  const forceRefresh = request.nextUrl.searchParams.get("refresh") === "1";
  const verdict = checkEntryRequest(limitKey(request.headers), parsed.entryId, forceRefresh);
  if (!verdict.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again shortly.", retryAfterSeconds: verdict.retryAfterSeconds },
      { status: 429, headers: { ...NO_STORE, "Retry-After": String(verdict.retryAfterSeconds) } }
    );
  }

  try {
    const payload = await getEntryRecommend(parsed.entryId, forceRefresh, horizon);
    // Issue #43 stage 5: the allowed team's rules-based recommendation is written to the log (best effort, not
    // awaited). Only the default 3-week horizon is logged, so the stored net gains are always on the same basis.
    if (horizon === 3 && isAllowedEntry(parsed.entryId)) {
      recordInBackground(payload);
    }
    return NextResponse.json(payload, { headers: NO_STORE });
  } catch (error) {
    if (error instanceof EntryNotFoundError) {
      return NextResponse.json({ error: "Team not found" }, { status: 404, headers: NO_STORE });
    }
    if (error instanceof EntryBusyError) {
      return NextResponse.json(
        { error: "Busy. Please try again shortly.", retryAfterSeconds: error.retryAfterSeconds },
        { status: 503, headers: { ...NO_STORE, "Retry-After": String(error.retryAfterSeconds) } }
      );
    }
    if (error instanceof FplUnavailableError) {
      return NextResponse.json({ error: "FPL data is unavailable" }, { status: 502, headers: NO_STORE });
    }

    console.error("[entry-recommend]", error);
    return NextResponse.json({ error: "Failed to build the recommendation" }, { status: 500, headers: NO_STORE });
  }
}
