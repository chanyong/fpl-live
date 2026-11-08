/**
 * In-memory limiter for the mail-sending endpoints (recover, resend). One process only, resets on deploy:
 * it is a brake on mail bombing, not a security boundary. Callers answer the same {ok:true} either way.
 */
const EMAIL_WINDOW_MS = 60_000;
const IP_WINDOW_MS = 10 * 60_000;
const IP_MAX = 5;
const MAX_KEYS = 5000;

const emailLast = new Map<string, number>();
const ipHits = new Map<string, number[]>();

export function resetRateLimits() {
  emailLast.clear();
  ipHits.clear();
}

function prune(now: number) {
  if (emailLast.size + ipHits.size < MAX_KEYS) return;
  for (const [key, at] of emailLast) if (now - at > EMAIL_WINDOW_MS) emailLast.delete(key);
  for (const [key, hits] of ipHits) if (!hits.some((at) => now - at <= IP_WINDOW_MS)) ipHits.delete(key);
}

/** True when this request may send a mail; records it. kind separates recover from resend. */
export function allowMailRequest(kind: string, email: string, ip: string, now = Date.now()) {
  prune(now);
  const emailKey = `${kind}:${email}`;
  const ipKey = `${kind}:${ip}`;
  const last = emailLast.get(emailKey);
  const recent = (ipHits.get(ipKey) ?? []).filter((at) => now - at <= IP_WINDOW_MS);
  if ((last !== undefined && now - last < EMAIL_WINDOW_MS) || recent.length >= IP_MAX) {
    ipHits.set(ipKey, recent);
    return false;
  }
  emailLast.set(emailKey, now);
  ipHits.set(ipKey, [...recent, now]);
  return true;
}

export const clientIp = (headers: Headers) => headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
