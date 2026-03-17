"use client";

type RefreshIndicatorProps = {
  buildId: string;
};

export function RefreshIndicator({ buildId }: RefreshIndicatorProps) {
  return (
    <div className="w-full rounded-[1.1rem] border border-[var(--border)] bg-[var(--surface)] px-3 py-3 shadow-sm md:w-auto md:min-w-[220px] md:px-3.5 md:text-right">
      <div>
        <div className="text-[13px] text-[var(--muted)] md:text-sm">페이지 재조회시 점수가 재계산됩니다.</div>
        <div className="mt-1 text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]/70">
          Build {buildId}
        </div>
      </div>
    </div>
  );
}
