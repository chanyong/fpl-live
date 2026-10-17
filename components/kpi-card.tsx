import type { ReactNode } from "react";

/** Wide and short: the label sits on top, the figure and its note share one line. */
export function KpiCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-[var(--border)] bg-white/80 px-2.5 py-1.5">
      <div className="truncate text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)]">{label}</div>
      <div className="flex min-w-0 items-baseline gap-1.5">
        <span className="shrink-0 text-lg font-semibold leading-tight tabular-nums md:text-xl">{value}</span>
        <span className="min-w-0 truncate text-[10px] text-[var(--muted)] md:text-[11px]">{sub}</span>
      </div>
    </div>
  );
}

/** Cards share the row evenly: 2 columns on phones (no sideways scrolling), more on wider screens. */
export function KpiGrid({
  label,
  columns = 4,
  children
}: {
  label: string;
  columns?: 2 | 3 | 4;
  children: ReactNode;
}) {
  const layout =
    columns === 2 ? "grid-cols-2" : columns === 3 ? "grid-cols-3" : "grid-cols-2 md:grid-cols-4";

  return (
    <section aria-label={label} className={`grid gap-1.5 ${layout}`}>
      {children}
    </section>
  );
}
