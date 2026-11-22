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
  return (
    <header className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-2 ${className}`}>
      <SiteLogo tone={tone} />
      <SiteNav tone={tone} className="order-last w-full md:order-none md:ml-2 md:w-auto" />
      <div className="ml-auto flex flex-wrap items-center justify-end gap-2">{children}</div>
    </header>
  );
}
