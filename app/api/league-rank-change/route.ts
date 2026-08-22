import { NextRequest, NextResponse } from "next/server";
import { getLeagueRankChangePayload } from "@/lib/rank-change-aggregator";
import { parseLeagueId } from "@/lib/request-params";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const league = parseLeagueId(request.nextUrl.searchParams.get("leagueId"));
  if ("error" in league) {
    return NextResponse.json({ error: league.error }, { status: 400 });
  }

  try {
    const payload = await getLeagueRankChangePayload({ leagueId: league.leagueId });

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load rank change data";

    console.error("[league-rank-change]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
