import type { ReactNode } from "react";

/**
 * Main content beside a sticky side panel on wide screens; stacked on narrow ones.
 * Every tab uses it so the summary always sits in the same place.
 *
 * `sideFirst` decides which comes first when stacked: summaries lead on most tabs, while the
 * rank chart keeps the top spot and lets its manager picker follow.
 */
export function SidePanelLayout({
  side,
  children,
  sideFirst = true
}: {
  side: ReactNode;
  children: ReactNode;
  sideFirst?: boolean;
}) {
  return (
    <div className="grid gap-1.5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
      <div
        className={`space-y-1.5 lg:sticky lg:top-2 lg:order-2 ${sideFirst ? "order-1" : "order-2"}`}
      >
        {side}
      </div>
      <div className={`min-w-0 lg:order-1 ${sideFirst ? "order-2" : "order-1"}`}>{children}</div>
    </div>
  );
}
