import { NextResponse } from "next/server";
import { getPriceChangePlayers } from "@/lib/player-stats";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const players = await getPriceChangePlayers();

    return NextResponse.json(
      { players },
      { headers: { "Cache-Control": "public, max-age=30, s-maxage=60" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load price changes";

    console.error("[price-changes]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
