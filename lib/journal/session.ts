import type { NextRequest } from "next/server";
import { storeFromEnv } from "@/lib/journal/supabase-store";
import type { JournalStore, JournalUser } from "@/lib/journal/types";

const SECURE = process.env.NODE_ENV === "production";
export const SESSION_COOKIE = SECURE ? "__Host-fpl_journal" : "fpl_journal";

export const sessionCookieOptions = (maxAgeSeconds: number) => ({
  httpOnly: true,
  secure: SECURE,
  sameSite: "lax" as const,
  path: "/",
  maxAge: maxAgeSeconds
});

export function requireStore(): JournalStore | null {
  return storeFromEnv();
}

export async function currentMember(
  request: NextRequest,
  store: JournalStore
): Promise<{ user: JournalUser; token: string } | null> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const user = await store.getUser(token);
  return user ? { user, token } : null;
}

/** Same-origin check for state-changing requests (cookie auth, so guard against cross-site posts). */
export function isSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  return !origin || origin === request.nextUrl.origin;
}
