import { NextRequest, NextResponse } from "next/server";
import { isSameOrigin, requireStore, SESSION_COOKIE, sessionCookieOptions } from "@/lib/journal/session";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const store = requireStore();
  if (token && store) await store.signOut(token);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", sessionCookieOptions(0));
  return response;
}
