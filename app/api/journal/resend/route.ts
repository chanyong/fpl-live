import { NextRequest, NextResponse } from "next/server";
import { journalReturnUrl } from "@/lib/journal/recovery";
import { allowMailRequest, clientIp } from "@/lib/journal/rate-limit";
import { isSameOrigin, requireStore } from "@/lib/journal/session";
import { emailSchema } from "@/lib/journal/types";

export const dynamic = "force-dynamic";

/** Always answers { ok: true } for a well-formed email, whether or not the account exists or needs the mail. */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const store = requireStore();
  if (!store) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  const parsed = emailSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });

  // Over the limit: skip the mail but answer exactly the same.
  if (!allowMailRequest("resend", parsed.data.email, clientIp(request.headers))) return NextResponse.json({ ok: true });

  try {
    await store.resendConfirmation(parsed.data.email, journalReturnUrl());
  } catch {
    console.error("journal: resend request errored");
  }
  return NextResponse.json({ ok: true });
}
