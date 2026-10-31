"use client";

import { ChartScroll } from "@/components/charts/chart-scroll";
import { useLocale } from "@/components/locale-provider";

export type SeriesPoint = {
  label: string;
  value: number;
  tooltip?: string;
};

const WIDTH = 640;
const HEIGHT = 150;
// left fits a 13px axis label such as "10,512k" or "-1000k" (about 48px) right-aligned at M.left - 8.
const M = { left: 60, right: 10, top: 26, bottom: 22 };
// Below this many units per gameweek, 13px two-digit labels touch, so only every other one is printed.
const MIN_LABEL_STEP = 22;
const PLOT_W = WIDTH - M.left - M.right;
const PLOT_H = HEIGHT - M.top - M.bottom;

function niceMax(value: number) {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  return Math.ceil(value / magnitude) * magnitude;
}

/**
 * Column chart with a real zero baseline, so negative values (net transfers out)
 * hang below the line instead of being drawn as if they were positive.
 */
export function BarSeries({
  points,
  format = (value: number) => String(value),
  diverging = false,
  showValues = false
}: {
  points: SeriesPoint[];
  format?: (value: number) => string;
  diverging?: boolean;
  /** Print each bar's value next to it, for series where the exact figure matters. */
  showValues?: boolean;
}) {
  const { tr } = useLocale();
  if (points.length === 0) {
    return <p className="py-6 text-center text-caption text-[var(--muted)]">{tr("기록 없음", "No data")}</p>;
  }

  const values = points.map((point) => point.value);
  const top = niceMax(Math.max(0, ...values));
  const bottom = diverging ? -niceMax(Math.abs(Math.min(0, ...values))) : 0;
  const span = top - bottom || 1;

  const y = (value: number) => M.top + PLOT_H - ((value - bottom) / span) * PLOT_H;
  const zero = y(0);
  const step = PLOT_W / points.length;
  const barWidth = Math.max(3, Math.min(26, step - 6));
  const labelEvery = step < MIN_LABEL_STEP ? 2 : 1;

  return (
    <ChartScroll><svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" style={{ minWidth: WIDTH }} role="img">
      <line x1={M.left} x2={WIDTH - M.right} y1={zero} y2={zero} stroke="var(--border)" strokeWidth={1} />
      <text x={M.left - 8} y={y(top) + 4} textAnchor="end" fontSize={13} fill="var(--muted)">
        {format(top)}
      </text>
      {bottom < 0 ? (
        <text x={M.left - 8} y={y(bottom) + 4} textAnchor="end" fontSize={13} fill="var(--muted)">
          {format(bottom)}
        </text>
      ) : null}
      <text x={M.left - 8} y={zero + 4} textAnchor="end" fontSize={13} fill="var(--muted)">
        0
      </text>

      {points.map((point, index) => {
        const cx = M.left + step * index + step / 2;
        const valueY = y(point.value);
        const height = Math.max(2, Math.abs(valueY - zero));
        const negative = point.value < 0;

        return (
          <g key={point.label}>
            <rect
              x={cx - barWidth / 2}
              y={negative ? zero : valueY}
              width={barWidth}
              height={height}
              rx={3}
              fill={negative ? "var(--chart-out)" : "var(--chart-in)"}
            >
              <title>{point.tooltip ?? `${point.label} · ${format(point.value)}`}</title>
            </rect>
            {/* On a phone the chart opens scrolled to the latest week, past the y axis, so that bar's value is always printed. */}
            {showValues || index === points.length - 1 ? (
              <text
                x={cx}
                y={negative ? zero + height + 17 : valueY - 6}
                textAnchor="middle"
                fontSize={16}
                fontWeight={700}
                fill="var(--text)"
              >
                {format(point.value)}
              </text>
            ) : null}
            {(points.length - 1 - index) % labelEvery === 0 ? (
              <text x={cx} y={HEIGHT - 7} textAnchor="middle" fontSize={13} fill="var(--muted)">
                {point.label}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg></ChartScroll>
  );
}

/** Single-series trend. One measure, one axis — never a second scale on the right. */
export function LineSeries({
  points,
  format = (value: number) => String(value)
}: {
  points: SeriesPoint[];
  format?: (value: number) => string;
}) {
  const { tr } = useLocale();
  if (points.length === 0) {
    return <p className="py-6 text-center text-caption text-[var(--muted)]">{tr("기록 없음", "No data")}</p>;
  }

  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = (max - min) * 0.12 || Math.max(Math.abs(max) * 0.05, 1);
  const low = min - pad;
  const span = max + pad - low || 1;

  const y = (value: number) => M.top + PLOT_H - ((value - low) / span) * PLOT_H;
  const step = points.length > 1 ? PLOT_W / (points.length - 1) : 0;
  const x = (index: number) => (points.length > 1 ? M.left + step * index : M.left + PLOT_W / 2);
  const labelEvery = points.length > 1 && step < MIN_LABEL_STEP ? 2 : 1;

  const path = points.map((point, index) => `${index === 0 ? "M" : "L"}${x(index)} ${y(point.value)}`).join(" ");
  const last = points[points.length - 1];

  return (
    <ChartScroll><svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" style={{ minWidth: WIDTH }} role="img">
      <line x1={M.left} x2={WIDTH - M.right} y1={y(max)} y2={y(max)} stroke="var(--border)" strokeWidth={0.6} />
      <line x1={M.left} x2={WIDTH - M.right} y1={y(min)} y2={y(min)} stroke="var(--border)" strokeWidth={0.6} />
      <text x={M.left - 8} y={y(max) + 4} textAnchor="end" fontSize={13} fill="var(--muted)">
        {format(max)}
      </text>
      <text x={M.left - 8} y={y(min) + 4} textAnchor="end" fontSize={13} fill="var(--muted)">
        {format(min)}
      </text>

      <path d={path} fill="none" stroke="var(--chart-in)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

      {points.map((point, index) => (
        <circle key={point.label} cx={x(index)} cy={y(point.value)} r={4} fill="var(--chart-in)" stroke="var(--surface)" strokeWidth={2}>
          <title>{point.tooltip ?? `${point.label} · ${format(point.value)}`}</title>
        </circle>
      ))}

      {/* The endpoint is the number people actually want, so it is labelled outright. */}
      <text
        x={x(points.length - 1)}
        y={y(last.value) - 10}
        textAnchor="end"
        fontSize={13}
        fontWeight={600}
        fill="var(--text)"
      >
        {format(last.value)}
      </text>

      {points.map((point, index) =>
        (points.length - 1 - index) % labelEvery === 0 ? (
          <text key={`x${point.label}`} x={x(index)} y={HEIGHT - 7} textAnchor="middle" fontSize={13} fill="var(--muted)">
            {point.label}
          </text>
        ) : null
      )}
    </svg></ChartScroll>
  );
}
