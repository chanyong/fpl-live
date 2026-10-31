"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

/**
 * Side-scroller for a chart drawn at its real size, so its 13px labels stay 13px (issue #2).
 * When the chart is wider than the screen it opens at the right end, where the latest gameweek
 * is, instead of at GW1. It stays pinned there through resizes and rotations for as long as the
 * reader has not scrolled away, and changing `resetKey` (say, a new period) pins it again.
 */
export function ChartScroll({
  children,
  resetKey,
  className = ""
}: {
  children: ReactNode;
  resetKey?: string | number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);

  // Layout effect, so the first frame already shows the latest week rather than GW1.
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;

    pinned.current = true;
    element.scrollLeft = element.scrollWidth;

    const onScroll = () => {
      pinned.current = element.scrollLeft + element.clientWidth >= element.scrollWidth - 2;
    };
    element.addEventListener("scroll", onScroll, { passive: true });

    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => {
            if (pinned.current) element.scrollLeft = element.scrollWidth;
          });
    observer?.observe(element);

    return () => {
      element.removeEventListener("scroll", onScroll);
      observer?.disconnect();
    };
  }, [resetKey]);

  return (
    // Focusable so the chart can be scrolled with the keyboard too.
    <div
      ref={ref}
      tabIndex={0}
      className={`overflow-x-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${className}`.trim()}
    >
      {children}
    </div>
  );
}
