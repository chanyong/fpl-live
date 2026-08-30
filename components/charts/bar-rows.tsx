"use client";

import type { ReactNode } from "react";

export type BarRow = {
  key: number | string;
  label: string;
  sub?: string;
  /** Magnitude drawn to the left of the zero line. */
  left?: number;
  /** Magnitude drawn to the right of the zero line, or the whole bar when there is no axis. */
  right: number;
  value: ReactNode;
  tooltip?: string;
  onSelect?: () => void;
};

type Props = {
  rows: BarRow[];
  max: number;
  scale?: { left: string; mid: string; right: string };
  /** Widen the value column when the number carries a suffix. */
  valueWidth?: string;
};

function Name({ label, sub }: { label: string; sub?: string }) {
  return (
    <span className="truncate text-right text-[13px]">
      {label}
      {sub ? <span className="ml-1 text-[11px] text-[var(--muted)]">{sub}</span> : null}
    </span>
  );
}

/** Zero in the middle, one colour each side. The number sits in its own column so a
 *  full-width bar can never collide with its own label. */
export function DivergingRows({ rows, max, scale, valueWidth = "72px" }: Props) {
  const safeMax = max > 0 ? max : 1;

  return (
    <div className="min-w-[440px]">
      {rows.map((row) => {
        const leftWidth = ((row.left ?? 0) / safeMax) * 50;
        const rightWidth = (row.right / safeMax) * 50;
        const Wrapper = row.onSelect ? "button" : "div";

        return (
          <Wrapper
            key={row.key}
            {...(row.onSelect ? { type: "button" as const, onClick: row.onSelect } : {})}
            title={row.tooltip}
            className={`grid w-full items-center gap-2 py-[3px] text-left ${
              row.onSelect ? "rounded-md transition hover:bg-[var(--surface-strong)]/50" : ""
            }`}
            style={{ gridTemplateColumns: `96px 1fr ${valueWidth}` }}
          >
            <Name label={row.label} sub={row.sub} />
            <span className="relative block h-[20px]">
              <span className="absolute -top-[3px] -bottom-[3px] left-1/2 w-px bg-[var(--border)]" />
              {row.left !== undefined ? (
                <span
                  className="absolute top-[2px] h-[16px] rounded-l-[4px]"
                  style={{ right: "50%", width: `${leftWidth}%`, background: "var(--chart-out)" }}
                />
              ) : null}
              <span
                className="absolute top-[2px] h-[16px] rounded-r-[4px]"
                style={{ left: "50%", width: `${rightWidth}%`, background: "var(--chart-in)" }}
              />
            </span>
            <span className="text-right text-[12px] tabular-nums text-[var(--muted)]">{row.value}</span>
          </Wrapper>
        );
      })}

      {scale ? (
        <div
          className="grid items-center gap-2 pt-1"
          style={{ gridTemplateColumns: `96px 1fr ${valueWidth}` }}
        >
          <span />
          <span className="flex justify-between text-[10px] text-[var(--muted)]">
            <span>{scale.left}</span>
            <span>{scale.mid}</span>
            <span>{scale.right}</span>
          </span>
          <span />
        </div>
      ) : null}
    </div>
  );
}

/** Plain magnitude comparison — one hue, because there is no second category here. */
export function MagnitudeRows({ rows, max, valueWidth = "104px" }: Props) {
  const safeMax = max > 0 ? max : 1;

  return (
    <div className="min-w-[420px]">
      {rows.map((row) => {
        const width = (row.right / safeMax) * 100;
        const Wrapper = row.onSelect ? "button" : "div";

        return (
          <Wrapper
            key={row.key}
            {...(row.onSelect ? { type: "button" as const, onClick: row.onSelect } : {})}
            title={row.tooltip}
            className={`grid w-full items-center gap-2 py-[3px] text-left ${
              row.onSelect ? "rounded-md transition hover:bg-[var(--surface-strong)]/50" : ""
            }`}
            style={{ gridTemplateColumns: `96px 1fr ${valueWidth}` }}
          >
            <Name label={row.label} sub={row.sub} />
            <span className="relative block h-[20px]">
              <span
                className="absolute top-[2px] left-0 h-[16px] min-w-[2px] rounded-[4px]"
                style={{ width: `${width}%`, background: "var(--chart-in)" }}
              />
            </span>
            <span className="text-right text-[12px] tabular-nums text-[var(--muted)]">{row.value}</span>
          </Wrapper>
        );
      })}
    </div>
  );
}
