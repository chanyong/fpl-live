"use client";

import type { TeamFixtureOutlook } from "@/lib/types";
import { useLocale } from "@/components/locale-provider";

/** Official FPL scale, green to maroon. The number is printed in every cell, so colour is never the only cue. */
export function difficultyStyle(difficulty: number) {
  const clamped = Math.min(Math.max(Math.round(difficulty), 1), 5);

  return {
    background: `var(--fdr-${clamped})`,
    color: clamped === 2 || clamped === 3 ? "#1b1b1b" : "#ffffff"
  };
}

/** The strip's mean, as a pill. The exact figure is printed; the tint only echoes it. */
export function FdrAverage({ value, count }: { value: number | null; count: number }) {
  const { tr } = useLocale();
  if (value === null) {
    return <span className="text-caption text-[var(--muted)]">-</span>;
  }

  return (
    <span
      title={tr(
        `다음 ${count}경기 평균 난이도 ${value.toFixed(1)} — 낮을수록 쉬움`,
        `Average difficulty of the next ${count} fixtures: ${value.toFixed(1)} (lower is easier)`
      )}
      className="inline-flex min-w-[30px] justify-center rounded-[4px] px-1 py-[1px] text-caption font-semibold tabular-nums"
      style={difficultyStyle(value)}
    >
      {value.toFixed(1)}
    </span>
  );
}

export function FdrStrip({
  fixtures,
  compact = false
}: {
  fixtures: TeamFixtureOutlook[];
  compact?: boolean;
}) {
  const { tr } = useLocale();
  if (fixtures.length === 0) {
    return <span className="text-caption text-[var(--muted)]">{tr("일정 미정", "No fixtures")}</span>;
  }

  if (compact) {
    return (
      <span className="flex gap-[2px]">
        {fixtures.map((fixture) => (
          <span
            key={fixture.gw}
            title={tr(
              `GW${fixture.gw} · ${fixture.home ? "홈" : "원정"} ${fixture.opponent} · 난이도 ${fixture.difficulty}`,
              `GW${fixture.gw} · ${fixture.home ? "Home" : "Away"} ${fixture.opponent} · difficulty ${fixture.difficulty}`
            )}
            className="inline-flex h-[16px] w-[16px] items-center justify-center rounded-[3px] text-caption font-semibold tabular-nums"
            style={difficultyStyle(fixture.difficulty)}
          >
            {fixture.difficulty}
          </span>
        ))}
      </span>
    );
  }

  return (
    <div className="flex gap-1">
      {fixtures.map((fixture) => (
        <div
          key={fixture.gw}
          className="flex-1 rounded-[6px] px-1 py-1 text-center text-caption leading-tight"
          style={difficultyStyle(fixture.difficulty)}
          title={tr(
              `GW${fixture.gw} · ${fixture.home ? "홈" : "원정"} ${fixture.opponent} · 난이도 ${fixture.difficulty}`,
              `GW${fixture.gw} · ${fixture.home ? "Home" : "Away"} ${fixture.opponent} · difficulty ${fixture.difficulty}`
            )}
        >
          <span className="block text-caption opacity-80">GW{fixture.gw}</span>
          <span className="block font-semibold">{fixture.opponent}</span>
          <span className="block text-caption opacity-80">
            {fixture.home ? tr("홈", "H") : tr("원정", "A")} · {fixture.difficulty}
          </span>
        </div>
      ))}
    </div>
  );
}
