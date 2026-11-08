import { NextRequest, NextResponse } from "next/server";
import { currentMember, requireStore } from "@/lib/journal/session";

export const dynamic = "force-dynamic";

/** The signed-in member's own journal: auto-saved snapshots plus handwritten notes. Private to the member. */
export async function GET(request: NextRequest) {
  const store = requireStore();
  if (!store) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  const member = await currentMember(request, store);
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let loaded;
  try {
    loaded = await Promise.all([
      store.getProfile(member.user.id),
      store.listSnapshots(member.user.id, member.token),
      store.listNotes(member.user.id, member.token)
    ]);
  } catch (error) {
    console.error("journal: entries read failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "load_failed" }, { status: 502 });
  }
  const [profile, snapshots, notes] = loaded;
  const response = NextResponse.json({ email: member.user.email, teamId: profile?.teamId ?? null, snapshots, notes });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
