"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";

type RefreshIndicatorProps = {
  lastUpdated: string | null;
  isFetching: boolean;
};

export function RefreshIndicator({ lastUpdated, isFetching }: RefreshIndicatorProps) {
  const [isReloading, setIsReloading] = useState(false);

  const handleRefresh = () => {
    setIsReloading(true);
    window.location.reload();
  };

  return (
    <div className="w-full rounded-[1.25rem] border border-[var(--border)] bg-[var(--surface)] px-3 py-3 shadow-sm md:w-auto md:min-w-[220px] md:px-4 md:text-right">
      <div className="flex items-center justify-between gap-3 md:block">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--muted)] md:text-xs">
            Auto refresh 30s
          </div>
          <div className="mt-1 text-xs text-[var(--muted)] md:mt-2 md:text-sm">
            {lastUpdated
              ? `Updated ${formatDistanceToNow(new Date(lastUpdated), {
                  addSuffix: true
                })}`
              : "Waiting for first sync"}
          </div>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          className="shrink-0 rounded-full bg-[var(--text)] px-4 py-2 text-xs font-semibold text-white md:mt-3 md:w-full md:text-sm"
        >
          {isReloading || isFetching ? "Refreshing..." : "Refresh"}
        </button>
      </div>
    </div>
  );
}
