"use client";

import { useMemo } from "react";
import { DIFFERENTIAL_MIN_MINUTES } from "@/lib/player-metrics";
import type { PlayerStat } from "@/lib/types";
import { useLocale } from "@/components/locale-provider";

const WIDTH = 720;
const HEIGHT = 400;
const M = { left: 40, right: 14, top: 16, bottom: 40 };
const PLOT_W = WIDTH - M.left - M.right;
const PLOT_H = HEIGHT - M.top - M.bottom;

const MIN_MINUTES = DIFFERENTIAL_MIN_MINUTES;
const MAX_LABELS_IN_ZONE = 8;

type Props = {
  players: PlayerStat[];
  /** Ownership at or below this counts as a differential. */
  ownershipCut: number;
  /** Form at or above this counts as in-form. */
  formCut: number;
  ownedIds?: Set<number>;
  onSelect?: (elementId: number) => void;
};

type Box = { x1: number; x2: number; y1: number; y2: number };

export function FormScatter({ players, ownershipCut, formCut, ownedIds, onSelect }: Props) {
  const { tr } = useLocale();
  const model = useMemo(() => {
    const visible = players.filter((player) => player.minutes >= MIN_MINUTES && player.form > 0);
    const formMax = Math.max(6, ...visible.map((player) => player.form)) * 1.06;
    const selMax = Math.max(20, ...visible.map((player) => player.selectedByPercent)) * 1.05;

    const x = (sel: number) => M.left + (Math.sqrt(Math.max(sel, 0)) / Math.sqrt(selMax)) * PLOT_W;
    const y = (form: number) => M.top + PLOT_H - (form / formMax) * PLOT_H;

    const inZone = visible
      .filter((player) => player.selectedByPercent <= ownershipCut && player.form >= formCut)
      .sort((left, right) => right.form - left.form);

    // Draw the highlighted marks last so their surface ring sits above the grey cloud.
    const ordered = [...visible].sort((left, right) => {
      const l = left.selectedByPercent <= ownershipCut && left.form >= formCut ? 1 : 0;
      const r = right.selectedByPercent <= ownershipCut && right.form >= formCut ? 1 : 0;
      return l - r || left.form - right.form;
    });

    // Selective direct labels: the differential zone, plus a few anchors so the
    // crowded right-hand side is still readable.
    const anchors = [...visible].sort((a, b) => b.selectedByPercent - a.selectedByPercent).slice(0, 3);
    const peaks = [...visible].sort((a, b) => b.form - a.form).slice(0, 2);
    const candidates = [...new Set([...inZone.slice(0, MAX_LABELS_IN_ZONE), ...peaks, ...anchors])];

    const placed: Box[] = [];
    const overlaps = (box: Box) =>
      placed.some((other) => !(box.x2 < other.x1 || box.x1 > other.x2 || box.y2 < other.y1 || box.y1 > other.y2));

    const labels: Array<{ id: number; text: string; x: number; y: number; anchor: "start" | "end" }> = [];
    for (const player of candidates) {
      const cx = x(player.selectedByPercent);
      const cy = y(player.form);
      const width = player.webName.length * 6.4 + 10;

      for (const side of [1, -1]) {
        const tx = cx + side * 9;
        const box: Box = {
          x1: side > 0 ? tx : tx - width,
          x2: side > 0 ? tx + width : tx,
          y1: cy - 7,
          y2: cy + 7
        };
        if (box.x1 < M.left || box.x2 > WIDTH - M.right || overlaps(box)) {
          continue;
        }
        placed.push(box);
        labels.push({ id: player.id, text: player.webName, x: tx, y: cy + 4, anchor: side > 0 ? "start" : "end" });
        break;
      }
    }

    const formTicks: number[] = [];
    for (let tick = 0; tick <= formMax; tick += 2) {
      formTicks.push(tick);
    }
    const selTicks = [0, 2, 5, 10, 20, 40, 70].filter((tick) => tick <= selMax);

    return { visible, ordered, labels, x, y, formTicks, selTicks, inZoneCount: inZone.length };
  }, [players, ownershipCut, formCut]);

  if (model.visible.length === 0) {
    return (
      <p className="py-8 text-center text-meta text-[var(--muted)]">
        {tr(
          `아직 ${MIN_MINUTES}분 이상 출전한 선수가 없습니다. 첫 경기가 끝나면 채워집니다.`,
          `No player has played ${MIN_MINUTES}+ minutes yet. This fills in after the first match.`
        )}
      </p>
    );
  }

  const { x, y } = model;

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="w-full"
      role="img"
      aria-label={tr(
        `가로축 전체 소유율, 세로축 최근 폼. 소유율 ${ownershipCut}% 이하이면서 폼 ${formCut} 이상인 차별화 후보 ${model.inZoneCount}명이 강조되어 있습니다.`,
        `Overall ownership on the x-axis, recent form on the y-axis. ${model.inZoneCount} differentials (owned by ${ownershipCut}% or less, form ${formCut}+) are highlighted.`
      )}
    >
      <rect
        x={M.left}
        y={M.top}
        width={x(ownershipCut) - M.left}
        height={y(formCut) - M.top}
        fill="var(--accent-soft)"
      />

      {model.formTicks.map((tick) => (
        <g key={`f${tick}`}>
          <line x1={M.left} x2={WIDTH - M.right} y1={y(tick)} y2={y(tick)} stroke="var(--border)" strokeWidth={0.6} />
          <text x={M.left - 8} y={y(tick) + 3.5} textAnchor="end" fontSize={13} fill="var(--muted)">
            {tick}
          </text>
        </g>
      ))}
      {model.selTicks.map((tick) => (
        <g key={`s${tick}`}>
          <line x1={x(tick)} x2={x(tick)} y1={M.top} y2={M.top + PLOT_H} stroke="var(--border)" strokeWidth={0.6} />
          <text x={x(tick)} y={M.top + PLOT_H + 15} textAnchor="middle" fontSize={13} fill="var(--muted)">
            {tick}%
          </text>
        </g>
      ))}

      <line
        x1={x(ownershipCut)}
        x2={x(ownershipCut)}
        y1={M.top}
        y2={M.top + PLOT_H}
        stroke="var(--muted)"
        strokeWidth={1}
        strokeDasharray="3 3"
      />
      <line
        x1={M.left}
        x2={WIDTH - M.right}
        y1={y(formCut)}
        y2={y(formCut)}
        stroke="var(--muted)"
        strokeWidth={1}
        strokeDasharray="3 3"
      />

      <text x={M.left + 6} y={M.top + 14} fontSize={13} fill="var(--muted)" letterSpacing="0.06em">
        {tr("차별화 후보", "Differentials")}
      </text>
      <text x={WIDTH - M.right - 6} y={M.top + 14} textAnchor="end" fontSize={13} fill="var(--muted)" letterSpacing="0.06em">
        {tr("템플릿 핵심", "Template core")}
      </text>
      <text
        x={WIDTH - M.right - 6}
        y={M.top + PLOT_H - 7}
        textAnchor="end"
        fontSize={13}
        fill="var(--muted)"
        letterSpacing="0.06em"
      >
        {tr("탈출 후보", "Sell candidates")}
      </text>

      <text x={M.left + PLOT_W / 2} y={HEIGHT - 6} textAnchor="middle" fontSize={13} fill="var(--muted)">
        {tr("전체 소유율 (제곱근 척도)", "Overall ownership (square-root scale)")}
      </text>
      <text
        transform={`translate(11, ${M.top + PLOT_H / 2}) rotate(-90)`}
        textAnchor="middle"
        fontSize={13}
        fill="var(--muted)"
      >
        {tr("최근 폼", "Recent form")}
      </text>

      {model.ordered.map((player) => {
        const highlighted = player.selectedByPercent <= ownershipCut && player.form >= formCut;
        const owned = ownedIds?.has(player.id) ?? false;

        return (
          <circle
            key={player.id}
            cx={x(player.selectedByPercent)}
            cy={y(player.form)}
            r={highlighted ? 5.5 : 4}
            fill={highlighted ? "var(--chart-in)" : "var(--chart-mute)"}
            fillOpacity={highlighted ? 1 : 0.45}
            stroke={owned ? "var(--text)" : highlighted ? "var(--surface)" : "none"}
            strokeWidth={owned ? 1.6 : 2}
            style={onSelect ? { cursor: "pointer" } : undefined}
            onClick={onSelect ? () => onSelect(player.id) : undefined}
          >
            <title>
              {tr(
                `${player.webName} · ${player.teamShortName} ${player.position} · 폼 ${player.form} · 소유율 ${player.selectedByPercent}%${owned ? " · 리그 보유" : ""}`,
                `${player.webName} · ${player.teamShortName} ${player.position} · form ${player.form} · owned ${player.selectedByPercent}%${owned ? " · owned in league" : ""}`
              )}
            </title>
          </circle>
        );
      })}

      {model.labels.map((label) => (
        <text
          key={label.id}
          x={label.x}
          y={label.y}
          textAnchor={label.anchor}
          fontSize={13}
          fill="var(--text)"
          pointerEvents="none"
        >
          {label.text}
        </text>
      ))}
    </svg>
  );
}
