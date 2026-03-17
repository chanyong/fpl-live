import { NextRequest, NextResponse } from "next/server";
import { getLeagueRankChangePayload } from "@/lib/rank-change-aggregator";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const leagueId = request.nextUrl.searchParams.get("leagueId");
  const forceRefresh = request.nextUrl.searchParams.get("refresh") === "1";

  if (!leagueId) {
    return NextResponse.json({ error: "leagueId query parameter is required" }, { status: 400 });
  }

  try {
    const payload = await getLeagueRankChangePayload({
      leagueId: Number(leagueId),
      forceRefresh
    });

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load rank change data";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
