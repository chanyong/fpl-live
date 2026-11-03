"use client";

import { useEffect } from "react";
import { isFeedbackOpenClick, outboundLinkParams, trackEvent, trackSearch } from "@/lib/analytics";

/**
 * One document-level click listener for GA4 events (#19): outbound_click for links that leave the site
 * and feedback_open for the shared feedback button. Renders nothing.
 */
export function AnalyticsEvents() {
  useEffect(() => {
    function onClick(event: MouseEvent) {
      const path = event.composedPath();
      if (isFeedbackOpenClick(path)) {
        trackEvent("feedback_open", { page_path: window.location.pathname });
        return;
      }
      const anchor = path.find((target): target is HTMLAnchorElement => target instanceof HTMLAnchorElement && target.hasAttribute("href"));
      if (!anchor) return;
      const params = outboundLinkParams(anchor.getAttribute("href") ?? "", window.location.host);
      if (params) trackEvent("outbound_click", params);
    }

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return null;
}

const SEARCH_SETTLE_MS = 1500;

/**
 * Sends one search event after the user stops typing in a live filter box (no event per keystroke).
 * includeTerm=false sends only the count, for boxes that search people's names.
 */
export function useSearchTracking(value: string, area: string, includeTerm = true) {
  useEffect(() => {
    if (value.trim().length < 2) return;
    const timer = window.setTimeout(() => trackSearch(area, value, includeTerm), SEARCH_SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, [value, area, includeTerm]);
}
