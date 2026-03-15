"use client";

import { formatDistanceToNow } from "date-fns";

type RefreshIndicatorProps = {
  lastUpdated: string | null;
  isFetching: boolean;
  onRefresh: () => void;
};

export function RefreshIndicator({
  lastUpdated,
  isFetching,
  onRefresh
}: RefreshIndicatorProps) {
  return (
    <div className="w-full rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-left shadow-sm md:w-auto md:min-w-[220px] md:text-right">
      <div className="text-[11px] uppercase tracking-[0.2em] text-[var(--muted)] md:text-xs">
        Auto refresh 30s
      </div>
      <div className="mt-2 text-sm text-[var(--muted)]">
        {lastUpdated
          ? `Updated ${formatDistanceToNow(new Date(lastUpdated), {
              addSuffix: true
            })}`
          : "Waiting for first sync"}
      </div>
      <button
        type="button"
        onClick={onRefresh}
        className="mt-3 w-full rounded-full bg-[var(--text)] px-4 py-2 text-sm font-semibold text-white md:w-auto"
      >
        {isFetching ? "Refreshing..." : "Refresh now"}
      </button>
    </div>
  );
}
