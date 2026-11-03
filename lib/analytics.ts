// GA4 conversion events (#19). Uses the gtag already loaded in app/layout.tsx; no other tracker.
// This site has no affiliate links or alert sign-up, so only search, outbound_click and feedback_open exist.

export type AnalyticsEvent = "search" | "outbound_click" | "feedback_open";
export type AnalyticsParams = Record<string, string | number | boolean>;

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

/** Sends one GA4 event. Does nothing when gtag is missing (blocked, not loaded yet, tests, server). */
export function trackEvent(name: AnalyticsEvent, params: AnalyticsParams = {}): void {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  try {
    window.gtag("event", name, params);
  } catch {
    // Analytics must never break the page.
  }
}

const MAX_TERM_LENGTH = 50;

/**
 * Search text safe to send to GA: trimmed, lower-cased, cut to 50 characters.
 * Returns null for empty text or text that looks like personal data (an e-mail or a phone-length run of digits);
 * league IDs are at most 8 digits, so they pass.
 */
export function safeSearchTerm(raw: string): string | null {
  const term = raw.trim().toLowerCase().slice(0, MAX_TERM_LENGTH);
  if (term === "") return null;
  if (term.includes("@")) return null;
  if (term.replace(/\D/g, "").length >= 9) return null;
  return term;
}

/** Search event; the term is left out when it is not safe (the count still goes in). */
export function trackSearch(area: string, raw: string, includeTerm = true): void {
  const params: AnalyticsParams = { search_area: area };
  const term = includeTerm ? safeSearchTerm(raw) : null;
  if (term) params.search_term = term;
  trackEvent("search", params);
}

/** link_url/link_domain for a link that leaves this site, or null for same-site and non-web links. */
export function outboundLinkParams(href: string, currentHost: string): AnalyticsParams | null {
  let url: URL;
  try {
    url = new URL(href, `https://${currentHost}`);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.host === currentHost) return null;
  // Drop query and hash: they can carry utm tags or IDs that are not needed for counting.
  return { link_url: `${url.origin}${url.pathname}`, link_domain: url.hostname };
}

/** True when the click went to the shared feedback widget's open button (Shadow DOM inside #site-feedback). */
export function isFeedbackOpenClick(path: EventTarget[]): boolean {
  let onOpenButton = false;
  for (const target of path) {
    if (!(target instanceof Element)) continue;
    if (target.classList.contains("open-btn")) onOpenButton = true;
    if (target.id === "site-feedback") return onOpenButton;
  }
  return false;
}
