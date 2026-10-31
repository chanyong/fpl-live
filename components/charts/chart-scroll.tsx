"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Side-scroller for a chart drawn at its real size, so its 13px labels stay 13px (issue #2).
 * When the chart is wider than the screen it opens at the right end, where the latest gameweek
 * is, instead of at GW1. Changing `resetKey` (say, a new period) jumps back to the right end.
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

  useEffect(() => {
    const element = ref.current;
    if (element) {
      element.scrollLeft = element.scrollWidth;
    }
  }, [resetKey]);

  return (
    <div ref={ref} className={`overflow-x-auto ${className}`.trim()}>
      {children}
    </div>
  );
}
