import type { ReactNode } from "react";

/** Label and note stack on the left, the figure fills the right, so no side of the card sits empty. */
export function KpiCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-white/80 px-2.5 py-1.5">
      <div className="min-w-0">
        <div className="truncate text-[11px] font-semibold text-[var(--muted)]">{label}</div>
        <div className="truncate text-[10px] text-[var(--muted)] md:text-[11px]">{sub}</div>
      </div>
      <span className="max-w-[60%] shrink-0 truncate text-xl font-semibold leading-tight tabular-nums md:text-2xl">
        {value}
      </span>
    </div>
  );
}

/** Two columns on phones (no sideways scrolling); the player tab stacks its three on narrow screens. */
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
    columns === 2 ? "grid-cols-2" : columns === 3 ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-2 md:grid-cols-4";

  return (
    <section aria-label={label} className={`grid gap-1.5 ${layout}`}>
      {children}
    </section>
  );
}
