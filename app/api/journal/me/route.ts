import { NextRequest, NextResponse } from "next/server";
import { nextTeamChangeAt } from "@/lib/journal/service";
import { currentMember, requireStore } from "@/lib/journal/session";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store" };

/**
 * Who is signed in, for the screens that adapt to a member (issue #47): `{ member: false }` or
 * `{ member: true, teamId, nextTeamChangeAt }`. Cheap on purpose (no snapshots, no notes) and it never carries the email.
 * Without a session, a bad session or an unconfigured store the answer is the same `{ member: false }` with 200.
 */
export async function GET(request: NextRequest) {
  const store = requireStore();
  if (!store) return NextResponse.json({ member: false }, { headers: NO_STORE });
  try {
    const member = await currentMember(request, store);
    if (!member) return NextResponse.json({ member: false }, { headers: NO_STORE });
    const profile = await store.getProfile(member.user.id);
    return NextResponse.json(
      { member: true, teamId: profile?.teamId ?? null, nextTeamChangeAt: nextTeamChangeAt(profile?.teamChangedAt ?? null) },
      { headers: NO_STORE }
    );
  } catch (error) {
    console.error("journal: me read failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "load_failed" }, { status: 502, headers: NO_STORE });
  }
}
