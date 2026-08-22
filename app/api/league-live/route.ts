import { NextRequest, NextResponse } from "next/server";
import { getLeagueLivePayload } from "@/lib/league-aggregator";
import { parseGw, parseLeagueId } from "@/lib/request-params";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const league = parseLeagueId(request.nextUrl.searchParams.get("leagueId"));
  if ("error" in league) {
    return NextResponse.json({ error: league.error }, { status: 400 });
  }

  const event = parseGw(request.nextUrl.searchParams.get("gw"));
  if ("error" in event) {
    return NextResponse.json({ error: event.error }, { status: 400 });
  }

  const forceRefresh = request.nextUrl.searchParams.get("refresh") === "1";

  try {
    const payload = await getLeagueLivePayload({
      leagueId: league.leagueId,
      gw: event.gw,
      forceRefresh
    });

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load league data";

    console.error("[league-live]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
