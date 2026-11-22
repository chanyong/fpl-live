import { NextRequest, NextResponse } from "next/server";
import { checkEntryRequest } from "@/lib/entry-request-limit";
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
 * Rule-based lineup and captain candidates for one team (issue #43, stage 1-A): expected points from the
 * public FPL data, no login, no AI, nothing stored. It reads what /api/entry-squad reads (getEntrySquad) plus
 * the shared xP table, so it adds no FPL call.
 */
export async function GET(request: NextRequest) {
  const parsed = parseEntryId(request.nextUrl.searchParams.get("entryId"));
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400, headers: NO_STORE });
  }

  const forceRefresh = request.nextUrl.searchParams.get("refresh") === "1";
  const verdict = checkEntryRequest(limitKey(request.headers), parsed.entryId, forceRefresh);
  if (!verdict.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again shortly.", retryAfterSeconds: verdict.retryAfterSeconds },
      { status: 429, headers: { ...NO_STORE, "Retry-After": String(verdict.retryAfterSeconds) } }
    );
  }

  try {
    const payload = await getEntryRecommend(parsed.entryId, forceRefresh);
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
