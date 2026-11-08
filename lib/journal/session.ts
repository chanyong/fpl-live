import type { NextRequest } from "next/server";
import { siteUrl } from "@/lib/site";
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

/**
 * Same-origin check for state-changing requests (cookie auth, so guard against cross-site posts).
 * Behind Railway's proxy request.nextUrl.origin is the internal address, so compare against the public
 * origin (NEXT_PUBLIC_APP_URL) and the forwarded host/proto instead.
 * Without an Origin header only Sec-Fetch-Site same-origin/none is accepted.
 */
export function isSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) {
    const fetchSite = request.headers.get("sec-fetch-site");
    return fetchSite === "same-origin" || fetchSite === "none";
  }
  const allowed = new Set<string>([new URL(siteUrl()).origin]);
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (host) {
    const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
    allowed.add(`${proto}://${host.split(",")[0].trim()}`);
  }
  return allowed.has(origin);
}
