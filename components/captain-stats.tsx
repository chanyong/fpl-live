import type { CaptainStat } from "@/lib/types";

export function CaptainStats({ stats }: { stats: CaptainStat[] }) {
  if (stats.length === 0) {
    return null;
  }

  return (
    <section className="mb-3 hidden rounded-[1.4rem] border border-[var(--border)] bg-[var(--surface)] px-5 py-4 shadow-[0_14px_30px_rgba(55,40,20,0.06)] md:block">
      <div className="flex items-center justify-between gap-6">
        <h2 className="shrink-0 text-lg font-semibold">Top 3 Captain Picks</h2>
        <div className="grid flex-1 grid-cols-3 gap-4">
          {stats.map((captain) => (
            <div key={captain.elementId} className="flex items-center gap-3 rounded-2xl bg-white/80 px-3 py-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--surface-strong)] text-[11px] font-semibold text-[var(--muted)]">
                {captain.webName.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{captain.webName}</div>
                <div className="text-xs text-[var(--muted)]">{captain.percentage}%</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
