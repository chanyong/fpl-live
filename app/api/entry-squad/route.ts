import { NextRequest, NextResponse } from "next/server";
import { checkEntryRequest } from "@/lib/entry-request-limit";
import { EntryNotFoundError, FplUnavailableError, getEntrySquad } from "@/lib/entry-squad";
import { clientIp } from "@/lib/journal/rate-limit";
import { parseEntryId } from "@/lib/request-params";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE = { "Cache-Control": "no-store" };

/** One team's squad screen (issue #39 stage 2): FPL public data for that team ID, no login, nothing stored. */
export async function GET(request: NextRequest) {
  const parsed = parseEntryId(request.nextUrl.searchParams.get("entryId"));
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400, headers: NO_STORE });
  }

  const forceRefresh = request.nextUrl.searchParams.get("refresh") === "1";
  const verdict = checkEntryRequest(clientIp(request.headers), parsed.entryId, forceRefresh);
  if (!verdict.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again shortly.", retryAfterSeconds: verdict.retryAfterSeconds },
      { status: 429, headers: { ...NO_STORE, "Retry-After": String(verdict.retryAfterSeconds) } }
    );
  }

  try {
    const payload = await getEntrySquad(parsed.entryId, forceRefresh);
    return NextResponse.json(payload, { headers: NO_STORE });
  } catch (error) {
    if (error instanceof EntryNotFoundError) {
      return NextResponse.json({ error: "Team not found" }, { status: 404, headers: NO_STORE });
    }
    if (error instanceof FplUnavailableError) {
      return NextResponse.json({ error: "FPL data is unavailable" }, { status: 502, headers: NO_STORE });
    }

    console.error("[entry-squad]", error);
    return NextResponse.json({ error: "Failed to load the team" }, { status: 500, headers: NO_STORE });
  }
}
