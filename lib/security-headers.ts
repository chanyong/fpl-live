/**
 * Response headers sent on every route (issue #1, SITE_RULES 1-11).
 * CSP is left out on purpose: it needs the GA, Plausible and feedback-button (ddalkkakrank.kr)
 * script sources reviewed first, so it ships separately.
 */
export const SECURITY_HEADERS: ReadonlyArray<{ key: string; value: string }> = [
  { key: "Strict-Transport-Security", value: "max-age=63072000" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" }
];
