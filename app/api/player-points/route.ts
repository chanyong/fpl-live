import { NextRequest, NextResponse } from "next/server";
import { getPlayerPointsPayload } from "@/lib/player-points";
import { parseElementId, parseGw } from "@/lib/request-params";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** One player's gameweek score, line by line. Only ever hit when a score is opened. */
export async function GET(request: NextRequest) {
  const element = parseElementId(request.nextUrl.searchParams.get("elementId"));
  if ("error" in element) {
    return NextResponse.json({ error: element.error }, { status: 400 });
  }

  const event = parseGw(request.nextUrl.searchParams.get("gw"));
  if ("error" in event) {
    return NextResponse.json({ error: event.error }, { status: 400 });
  }

  try {
    const payload = await getPlayerPointsPayload({ elementId: element.elementId, gw: event.gw });

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load player points";

    console.error("[player-points]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
