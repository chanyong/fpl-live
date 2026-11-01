const FALLBACK_URL = "https://fpl-live-production-34f4.up.railway.app";

/** Public origin used for canonical links, the sitemap and share cards. */
export function siteUrl() {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (configured && !/localhost|127\.0\.0\.1/.test(configured)) {
    return configured.replace(/\/+$/, "");
  }

  return FALLBACK_URL;
}
