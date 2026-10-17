import type { ReactNode } from "react";

export function KpiCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-[var(--border)] bg-white/80 px-2.5 py-2 md:px-3">
      <div className="truncate text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)] md:text-[11px]">
        {label}
      </div>
      <div className="mt-0.5 truncate text-xl font-semibold leading-tight tabular-nums md:text-2xl">{value}</div>
      <div className="truncate text-[10px] text-[var(--muted)] md:text-[11px]">{sub}</div>
    </div>
  );
}

/** Cards share the row evenly: 2x2 on phones (no sideways scrolling), one row on wider screens. */
export function KpiGrid({
  label,
  columns = 4,
  children
}: {
  label: string;
  columns?: 3 | 4;
  children: ReactNode;
}) {
  return (
    <section
      aria-label={label}
      className={`mb-2 grid gap-1.5 md:gap-2 ${
        columns === 3 ? "grid-cols-3" : "grid-cols-2 md:grid-cols-4"
      }`}
    >
      {children}
    </section>
  );
}
