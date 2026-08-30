import { NextRequest, NextResponse } from "next/server";
import { getElementSummary } from "@/lib/fpl-client";
import { parseElementId } from "@/lib/request-params";
import type { PlayerHistoryResponse } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** One player's gameweek history. Only ever hit when a player is opened, never in bulk. */
export async function GET(request: NextRequest) {
  const element = parseElementId(request.nextUrl.searchParams.get("elementId"));
  if ("error" in element) {
    return NextResponse.json({ error: element.error }, { status: 400 });
  }

  try {
    const summary = await getElementSummary(element.elementId);

    // A double gameweek lists two fixtures in one round; fold them into a single point.
    const byRound = new Map<number, PlayerHistoryResponse["history"][number]>();
    for (const row of summary.history) {
      const existing = byRound.get(row.round);

      byRound.set(row.round, {
        gw: row.round,
        points: (existing?.points ?? 0) + row.total_points,
        minutes: (existing?.minutes ?? 0) + row.minutes,
        // Price and ownership are point-in-time, so the latest fixture of the round wins.
        value: row.value,
        selected: row.selected,
        transfersBalance: row.transfers_balance
      });
    }

    const payload: PlayerHistoryResponse = {
      elementId: element.elementId,
      history: [...byRound.values()].sort((left, right) => left.gw - right.gw)
    };

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load player history";

    console.error("[player-history]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
