"use client";

import type { ReactNode } from "react";
import { SiteLogo } from "@/components/site-logo";
import { SiteNav } from "@/components/site-nav";

/**
 * The top band every league-free and league screen shares (issue #39 stage 1): logo-and-home on the left,
 * the menu next to it (under it on a narrow screen), and whatever the screen needs on the right (language
 * toggle, share button).
 */
export function SiteHeader({
  tone = "app",
  className = "",
  children
}: {
  tone?: "app" | "home";
  className?: string;
  children?: ReactNode;
}) {
  // Divider lines (issue #39): on a narrow screen the menu is a row of its own, so it gets a thin line above and below;
  // from md up everything is one row, so only the header's bottom edge is lined.
  const line = tone === "home" ? "border-white/20" : "border-[var(--border)]";
  return (
    <header className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-2 md:border-b md:pb-2 ${line} ${className}`}>
      <SiteLogo tone={tone} />
      <SiteNav tone={tone} className={`order-last w-full border-y py-1.5 md:order-none md:ml-2 md:w-auto md:border-y-0 md:py-0 ${line}`} />
      <div className="ml-auto flex flex-wrap items-center justify-end gap-2">{children}</div>
    </header>
  );
}
