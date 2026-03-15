import { NextRequest, NextResponse } from "next/server";
import { getLeagueLivePayload } from "@/lib/league-aggregator";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const leagueId = request.nextUrl.searchParams.get("leagueId");
  const gw = request.nextUrl.searchParams.get("gw") ?? "current";
  const forceRefresh = request.nextUrl.searchParams.get("refresh") === "1";

  if (!leagueId) {
    return NextResponse.json(
      { error: "leagueId query parameter is required" },
      { status: 400 }
    );
  }

  try {
    const payload = await getLeagueLivePayload({
      leagueId: Number(leagueId),
      gw,
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

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
