import { NextRequest, NextResponse } from "next/server";
import { isSameOrigin, requireStore, SESSION_COOKIE, sessionCookieOptions } from "@/lib/journal/session";
import { loginSchema } from "@/lib/journal/types";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const store = requireStore();
  if (!store) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  const parsed = loginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });

  const session = await store.signIn(parsed.data.email, parsed.data.password);
  if ("error" in session) return NextResponse.json({ error: "login_failed" }, { status: 401 });

  const response = NextResponse.json({ ok: true });
  // Supabase access tokens last an hour by default; the cookie follows that.
  response.cookies.set(SESSION_COOKIE, session.accessToken, sessionCookieOptions(60 * 60));
  return response;
}
