import { NextRequest, NextResponse } from "next/server";
import { currentMember, isSameOrigin, requireStore } from "@/lib/journal/session";
import { notesSchema } from "@/lib/journal/types";

export const dynamic = "force-dynamic";

export async function PUT(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const store = requireStore();
  if (!store) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  const member = await currentMember(request, store);
  if (!member) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = notesSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });

  try {
    await store.saveNotes(member.user.id, member.token, parsed.data);
  } catch {
    return NextResponse.json({ error: "save_failed" }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
