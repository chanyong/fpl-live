"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { isFeedbackOpenClick, outboundLinkParams, trackEvent, trackPageView, trackSearch } from "@/lib/analytics";

const PAGE_VIEW_SETTLE_MS = 300;

/**
 * One document-level click listener for GA4 events (#19): outbound_click for links that leave the site
 * and feedback_open for the shared feedback button, plus a page_view for each in-app navigation (#33).
 * Renders nothing.
 */
export function AnalyticsEvents() {
  const pathname = usePathname();
  const firstPath = useRef(true);

  useEffect(() => {
    // The first view is sent by gtag('config'). Later ones wait a moment so the new tab title is in place.
    if (firstPath.current) {
      firstPath.current = false;
      return;
    }
    const timer = window.setTimeout(() => trackPageView(window.location), PAGE_VIEW_SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, [pathname]);

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
