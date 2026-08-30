"use client";

import { useMemo, useState } from "react";
import { CaretDown, SortToggle } from "@/components/icons";
import { MagnitudeRows, type BarRow } from "@/components/charts/bar-rows";
import { formatMoney } from "@/lib/season-summary";
import { topBy } from "@/lib/player-metrics";
import type { LeaguePlayerStat } from "@/lib/types";

type SortKey =
  | "ownedBy"
  | "effectiveOwnership"
  | "gwPoints"
  | "seasonPoints"
  | "leagueContribution"
  | "seasonSwing";

const COLUMNS: Array<{ key: SortKey; label: string; format: (row: LeaguePlayerStat) => string; hint: string }> = [
  { key: "ownedBy", label: "보유", format: (row) => `${row.ownedBy}명`, hint: "이 선수를 스쿼드에 넣은 매니저 수" },
  {
    key: "effectiveOwnership",
    label: "EO",
    format: (row) => `${row.effectiveOwnership}%`,
    hint: "유효 소유율 — 선발만 세고 주장은 두 번 셉니다"
  },
  { key: "gwPoints", label: "금주", format: (row) => String(row.gwPoints), hint: "이번 게임위크 획득 점수" },
  { key: "seasonPoints", label: "누적", format: (row) => String(row.seasonPoints), hint: "시즌 누적 점수" },
  {
    key: "leagueContribution",
    label: "리그 기여",
    format: (row) => String(row.leagueContribution),
    hint: "누적 점수 × 보유 매니저 수 — 리그 전체에 뿌려진 점수"
  },
  {
    key: "seasonSwing",
    label: "순위 기여",
    format: (row) => (row.seasonSwing >= 0 ? `+${row.seasonSwing}` : String(row.seasonSwing)),
    hint: "누적 점수 × (1 − 리그 보유율) — 보유자가 리그 평균 대비 벌어놓은 점수"
  }
];

const PREVIEW = 12;

function DotRow({
  row,
  managerNames
}: {
  row: LeaguePlayerStat;
  managerNames: string[];
}) {
  const owners = new Set(row.owners);
  const captains = new Set(row.captains);

  return (
    <div className="grid items-center gap-2" style={{ gridTemplateColumns: "116px 1fr 58px" }}>
      <span className="truncate text-[13px]">
        {row.webName}
        <span className="ml-1 text-[11px] text-[var(--muted)]">{row.teamShortName}</span>
      </span>
      <span className="flex gap-[3px]">
        {managerNames.map((name, index) => {
          const isOwner = owners.has(index);
          const isCaptain = captains.has(index);

          return (
            <span
              key={name + index}
              title={`${name} · ${isCaptain ? "주장" : isOwner ? "보유" : "미보유"}`}
              className={`h-[13px] w-[13px] rounded-full border-[1.5px] ${
                isCaptain
                  ? "border-[var(--text)]"
                  : isOwner
                    ? "border-[var(--chart-in)]"
                    : "border-[var(--chart-mute-soft)]"
              }`}
              style={{ background: isOwner ? "var(--chart-in)" : "transparent" }}
            />
          );
        })}
      </span>
      <span className="text-right text-[12px] tabular-nums text-[var(--muted)]">
        {row.ownedBy}/{managerNames.length}
        {row.captains.length > 0 ? ` ⓒ${row.captains.length}` : ""}
      </span>
    </div>
  );
}

export function LeaguePlayersPanel({
  leaguePlayers,
  managerNames,
  onSelect
}: {
  leaguePlayers: LeaguePlayerStat[];
  managerNames: string[];
  onSelect: (elementId: number) => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("seasonPoints");
  const [expanded, setExpanded] = useState(false);
  const [swingWindow, setSwingWindow] = useState<"season" | "gw">("season");

  const managerCount = managerNames.length;

  const summary = useMemo(() => {
    const solo = leaguePlayers.filter((row) => row.ownedBy === 1);
    const template = leaguePlayers.filter((row) => row.ownedBy === managerCount);

    return { solo, template };
  }, [leaguePlayers, managerCount]);

  const swingRows: BarRow[] = useMemo(() => {
    const value = (row: LeaguePlayerStat) => (swingWindow === "season" ? row.seasonSwing : row.gwSwing);
    const points = (row: LeaguePlayerStat) => (swingWindow === "season" ? row.seasonPoints : row.gwPoints);

    return topBy(leaguePlayers, value, 8).map((row) => ({
      key: row.elementId,
      label: row.webName,
      sub: row.teamShortName,
      right: value(row),
      value: (
        <>
          +{value(row).toFixed(1)}
          <span className="ml-1 text-[var(--muted)]">
            {points(row)}점 · {row.ownedBy}명
          </span>
        </>
      ),
      tooltip: `${row.webName} · ${points(row)}점 · 리그 ${row.ownedBy}/${managerCount}명 (EO ${row.effectiveOwnership}%)`,
      onSelect: () => onSelect(row.elementId)
    }));
  }, [leaguePlayers, swingWindow, managerCount, onSelect]);

  const swingMax = swingRows.length > 0 ? swingRows[0].right : 1;

  const sorted = useMemo(
    () => [...leaguePlayers].sort((left, right) => right[sortKey] - left[sortKey]),
    [leaguePlayers, sortKey]
  );
  const visible = expanded ? sorted : sorted.slice(0, PREVIEW);
  const matrixRows = useMemo(
    () => [...leaguePlayers].sort((left, right) => right.ownedBy - left.ownedBy).slice(0, 6),
    [leaguePlayers]
  );

  if (leaguePlayers.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3">
      <section className="rounded-[1.2rem] border border-[var(--border)] bg-[var(--surface)] p-3 shadow-[0_12px_36px_rgba(55,40,20,0.07)]">
        <div className="mb-2">
          <h3 className="text-[1rem] font-semibold">순위 상승에 기여한 선수</h3>
          <p className="text-[12px] leading-relaxed text-[var(--muted)]">
            보유자가 리그 평균 대비 벌어놓은 점수입니다. 적게 보유될수록 커지고, 전원이 가진 선수는 아무도 끌어올리지 못합니다.
            <span className="block">
              {swingWindow === "season"
                ? "누적 = 시즌 점수 × (1 − 리그 보유율). 과거 라인업은 남지 않으므로 현재 스쿼드 기준입니다."
                : "이번 GW = 획득 점수 × (1 − 유효 소유율). 전원이 벤치에 앉힌 선수는 0입니다."}
            </span>
          </p>
        </div>

        <div className="mb-2 flex rounded-full border border-[var(--border)] bg-white p-0.5 text-[12px]">
          {(
            [
              { id: "season", label: "누적" },
              { id: "gw", label: "이번 GW" }
            ] as const
          ).map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setSwingWindow(option.id)}
              className={`rounded-full px-3 py-1 font-semibold transition ${
                swingWindow === option.id ? "bg-[var(--text)] text-white" : "text-[var(--muted)]"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {swingRows.length > 0 ? (
          <div className="overflow-x-auto">
            <MagnitudeRows rows={swingRows} max={swingMax} valueWidth="132px" />
          </div>
        ) : (
          <p className="py-4 text-center text-[13px] text-[var(--muted)]">
            아직 이번 게임위크에 점수를 낸 보유 선수가 없습니다.
          </p>
        )}
      </section>

      <section className="rounded-[1.2rem] border border-[var(--border)] bg-[var(--surface)] p-3 shadow-[0_12px_36px_rgba(55,40,20,0.07)]">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h3 className="text-[1rem] font-semibold">리그 보유 선수 {leaguePlayers.length}명</h3>
            <p className="text-[12px] text-[var(--muted)]">
              단독 보유 {summary.solo.length}명 · 전원 보유 {summary.template.length}명 · 헤더를 눌러 정렬합니다.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[620px] w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-[var(--border)] text-[10px] uppercase tracking-[0.08em] text-[var(--muted)]">
                <th className="px-2 py-2 text-left">선수</th>
                {COLUMNS.map((column) => {
                  const active = sortKey === column.key;

                  return (
                    <th key={column.key} className="px-2 py-2 text-right" title={column.hint}>
                      <button
                        type="button"
                        onClick={() => setSortKey(column.key)}
                        aria-sort={active ? "descending" : "none"}
                        className={`inline-flex items-center gap-1 ${active ? "text-[var(--text)]" : ""}`}
                      >
                        {column.label}
                        {active ? <CaretDown /> : <SortToggle />}
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr
                  key={row.elementId}
                  onClick={() => onSelect(row.elementId)}
                  className="cursor-pointer border-b border-[var(--border)] bg-white transition last:border-b-0 hover:bg-[var(--surface-strong)]/40"
                >
                  <td className="px-2 py-1.5">
                    <span className="font-semibold">{row.webName}</span>
                    <span className="ml-1 text-[11px] text-[var(--muted)]">
                      {row.teamShortName} · {row.position} · {formatMoney(row.cost)}
                    </span>
                  </td>
                  {COLUMNS.map((column) => (
                    <td key={column.key} className="px-2 py-1.5 text-right tabular-nums">
                      {column.format(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {sorted.length > PREVIEW ? (
          <button
            type="button"
            onClick={() => setExpanded((current) => !current)}
            className="mx-auto mt-2 flex items-center gap-1 text-[12px] text-[var(--muted)] transition hover:text-[var(--text)]"
          >
            {expanded ? "접기" : `${sorted.length - PREVIEW}명 더 보기`}
            <CaretDown className={expanded ? "rotate-180" : ""} />
          </button>
        ) : null}
      </section>

      <section className="rounded-[1.2rem] border border-[var(--border)] bg-[var(--surface)] p-3 shadow-[0_12px_36px_rgba(55,40,20,0.07)]">
        <div className="mb-2">
          <h3 className="text-[1rem] font-semibold">누가 갖고 있나</h3>
          <p className="text-[12px] text-[var(--muted)]">
            가장 많이 보유된 선수 6명. 세로로 훑으면 한 매니저가 템플릿에서 얼마나 벗어나 있는지 보입니다.
          </p>
        </div>
        <div className="overflow-x-auto">
          <div className="flex min-w-[460px] flex-col gap-1.5">
            {matrixRows.map((row) => (
              <DotRow key={row.elementId} row={row} managerNames={managerNames} />
            ))}
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-[var(--muted)]">
          <span className="flex items-center gap-1">
            <span className="h-[11px] w-[11px] rounded-full border-[1.5px] border-[var(--chart-in)] bg-[var(--chart-in)]" />
            보유
          </span>
          <span className="flex items-center gap-1">
            <span className="h-[11px] w-[11px] rounded-full border-[1.5px] border-[var(--text)] bg-[var(--chart-in)]" />
            주장
          </span>
          <span className="flex items-center gap-1">
            <span className="h-[11px] w-[11px] rounded-full border-[1.5px] border-[var(--chart-mute-soft)]" />
            미보유
          </span>
        </div>
      </section>

      {summary.solo.length > 0 ? (
        <section className="rounded-[1.2rem] border border-[var(--border)] bg-[var(--surface)] p-3 shadow-[0_12px_36px_rgba(55,40,20,0.07)]">
          <div className="mb-2">
            <h3 className="text-[1rem] font-semibold">단독 보유 {summary.solo.length}명</h3>
            <p className="text-[12px] text-[var(--muted)]">한 명만 가진 선수. 이 선수들이 리그 순위를 벌립니다.</p>
          </div>
          <ul className="flex flex-col gap-1">
            {[...summary.solo]
              .sort((left, right) => right.seasonPoints - left.seasonPoints)
              .slice(0, 8)
              .map((row) => (
                <li key={row.elementId}>
                  <button
                    type="button"
                    onClick={() => onSelect(row.elementId)}
                    className="flex w-full items-center justify-between gap-2 rounded-md px-1 py-1 text-left text-[13px] transition hover:bg-[var(--surface-strong)]/50"
                  >
                    <span className="min-w-0 truncate">
                      <span className="font-semibold">{row.webName}</span>
                      <span className="ml-1 text-[11px] text-[var(--muted)]">{row.teamShortName}</span>
                    </span>
                    <span className="whitespace-nowrap text-[12px] tabular-nums text-[var(--muted)]">
                      {managerNames[row.owners[0]] ?? "?"} · 누적 {row.seasonPoints}점
                    </span>
                  </button>
                </li>
              ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
