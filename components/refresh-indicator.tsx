"use client";

import { formatDistanceToNow } from "date-fns";

type RefreshIndicatorProps = {
  lastUpdated: string | null;
  buildId: string;
};

export function RefreshIndicator({ lastUpdated, buildId }: RefreshIndicatorProps) {
  return (
    <div className="w-full rounded-[1.1rem] border border-[var(--border)] bg-[var(--surface)] px-3 py-3 shadow-sm md:w-auto md:min-w-[220px] md:px-3.5 md:text-right">
      <div>
        <div className="text-[13px] text-[var(--muted)] md:text-sm">
          {lastUpdated
            ? `Updated ${formatDistanceToNow(new Date(lastUpdated), {
                addSuffix: true
              })}`
            : "Waiting for first sync"}
        </div>
        <div className="mt-1 text-[13px] text-[var(--muted)] md:text-sm">
          재조회시 점수가 재계산됩니다.
        </div>
      </div>
    </div>
  );
}