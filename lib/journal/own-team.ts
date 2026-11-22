import { NextResponse, type NextRequest } from "next/server";
import { currentMember, requireStore } from "@/lib/journal/session";

/**
 * "Is this the signed-in member's own team?" for the personal analysis APIs (issue #47). Reads the session cookie and the
 * registered team on every call (no cache): a team change or a logout takes effect on the next request.
 * unavailable = the member store could not be read (answered 503, so a short outage is not shown as "log in").
 */
export type OwnTeamVerdict = "ok" | "login_required" | "not_your_team" | "not_configured" | "unavailable";

export async function checkOwnTeam(request: NextRequest, entryId: number): Promise<OwnTeamVerdict> {
  const store = requireStore();
  if (!store) return "not_configured";
  try {
    const member = await currentMember(request, store);
    if (!member) return "login_required";
    const profile = await store.getProfile(member.user.id);
    return profile && profile.teamId === entryId ? "ok" : "not_your_team";
  } catch {
    return "unavailable";
  }
}

const NO_STORE = { "Cache-Control": "no-store" };

/** The refusal to send for a verdict, or null when the request may go on. */
export function ownTeamRefusal(verdict: OwnTeamVerdict): NextResponse | null {
  switch (verdict) {
    case "ok":
      return null;
    case "login_required":
      return NextResponse.json({ error: "login_required" }, { status: 401, headers: NO_STORE });
    case "not_your_team":
      return NextResponse.json({ error: "not_your_team" }, { status: 403, headers: NO_STORE });
    default:
      return NextResponse.json({ error: verdict }, { status: 503, headers: NO_STORE });
  }
}
