"use client";

import Link from "next/link";
import type { MouseEvent } from "react";

/** A plain left-click is handled in-app; a modified click (new tab, new window, download) is left to the browser. */
export function isPlainLeftClick(event: MouseEvent) {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

/**
 * Tab button shared by the dashboard's tab rows. Each tab is a real link to its own address, so it can be
 * opened in a new tab or shared; a plain click calls onSelect instead (the app navigates without a reload).
 */
export function TabLink({
  href,
  active,
  onSelect,
  className,
  children
}: {
  href: string;
  active: boolean;
  onSelect: () => void;
  className: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      role="tab"
      aria-selected={active}
      prefetch={false}
      onClick={(event) => {
        if (!isPlainLeftClick(event)) return;
        event.preventDefault();
        onSelect();
      }}
      className={className}
    >
      {children}
    </Link>
  );
}

export function SubTabs<T extends string>({
  label,
  items,
  value,
  hrefFor,
  onChange
}: {
  label: string;
  items: ReadonlyArray<{ id: T; label: string }>;
  value: T;
  hrefFor: (id: T) => string;
  onChange: (id: T) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="inline-flex w-full rounded-md border border-[var(--border)] bg-[var(--surface)] p-1 md:w-auto"
    >
      {items.map((item) => {
        const active = value === item.id;

        return (
          <TabLink
            key={item.id}
            href={hrefFor(item.id)}
            active={active}
            onSelect={() => onChange(item.id)}
            className={`flex-1 whitespace-nowrap rounded-md px-3 py-1.5 text-center text-meta font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] md:flex-none ${
              active ? "bg-[var(--accent-soft)] text-[var(--accent-ink)] shadow-[inset_0_0_0_1px_var(--accent)]" : "text-[var(--muted)] hover:text-[var(--text)]"
            }`}
          >
            {item.label}
          </TabLink>
        );
      })}
    </div>
  );
}
