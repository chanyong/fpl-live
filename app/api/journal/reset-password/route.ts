import { NextRequest, NextResponse } from "next/server";
import { isSameOrigin, requireStore } from "@/lib/journal/session";
import { resetPasswordSchema } from "@/lib/journal/types";

export const dynamic = "force-dynamic";

/** Sets the new password with the recovery token from the mail link. No session cookie is issued: the user logs in afterwards. */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const store = requireStore();
  if (!store) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  const parsed = resetPasswordSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });

  const result = await store.updatePassword(parsed.data.accessToken, parsed.data.password);
  if (result === "ok") return NextResponse.json({ ok: true });
  const expired = result === "invalid_token";
  return NextResponse.json({ error: expired ? "link_expired" : "reset_failed" }, { status: expired ? 401 : 400 });
}
