import { NextRequest, NextResponse } from "next/server";
import { journalReturnUrl } from "@/lib/journal/recovery";
import { isSameOrigin, requireStore } from "@/lib/journal/session";
import { emailSchema } from "@/lib/journal/types";

export const dynamic = "force-dynamic";

/** Always answers { ok: true } for a well-formed email, whether or not an account exists or the mail was sent. */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const store = requireStore();
  if (!store) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  const parsed = emailSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });

  try {
    await store.requestPasswordReset(parsed.data.email, journalReturnUrl());
  } catch {
    console.error("journal: recover request errored");
  }
  return NextResponse.json({ ok: true });
}
