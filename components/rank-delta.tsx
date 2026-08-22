import { CaretDown, CaretUp } from "@/components/icons";

/**
 * Movement between the official standing and the live projection.
 * Positive means the manager has climbed.
 */
export function RankDelta({ from, to, className }: { from: number; to: number; className?: string }) {
  const delta = from - to;

  if (!Number.isFinite(delta) || delta === 0) {
    return (
      <span className={`text-[var(--muted)] ${className ?? ""}`} title="공식 순위와 동일">
        &ndash;
      </span>
    );
  }

  const up = delta > 0;

  return (
    <span
      className={`inline-flex items-center gap-0.5 font-semibold tabular-nums ${
        up ? "text-emerald-700" : "text-rose-700"
      } ${className ?? ""}`}
      title={`공식 ${from}위 → 잠정 ${to}위`}
    >
      {up ? <CaretUp /> : <CaretDown />}
      {Math.abs(delta)}
    </span>
  );
}
