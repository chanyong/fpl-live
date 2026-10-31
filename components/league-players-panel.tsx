"use client";

import { useMemo, useState } from "react";
import { CaretDown, SortToggle } from "@/components/icons";
import { MagnitudeRows, type BarRow } from "@/components/charts/bar-rows";
import { formatMoney } from "@/lib/season-summary";
import { topBy } from "@/lib/player-metrics";
import type { LeaguePlayerStat } from "@/lib/types";
import { useLocale } from "@/components/locale-provider";

type SortKey =
  | "ownedBy"
  | "effectiveOwnership"
  | "gwPoints"
  | "seasonPoints"
  | "leagueContribution"
  | "seasonSwing";

type Tr = <T = string>(ko: T, en: T) => T;

function buildColumns(
  tr: Tr
): Array<{ key: SortKey; label: string; format: (row: LeaguePlayerStat) => string; hint: string }> {
  return [
    {
      key: "ownedBy",
      label: tr("보유", "Owned"),
      format: (row) => tr(`${row.ownedBy}명`, String(row.ownedBy)),
      hint: tr("이 선수를 스쿼드에 넣은 매니저 수", "Managers with this player in their squad")
    },
    {
      key: "effectiveOwnership",
      label: "EO",
      format: (row) => `${row.effectiveOwnership}%`,
      hint: tr("유효 소유율 — 선발만 세고 주장은 두 번 셉니다", "Effective ownership: starters only, captains counted twice")
    },
    {
      key: "gwPoints",
      label: tr("금주", "This GW"),
      format: (row) => String(row.gwPoints),
      hint: tr("이번 게임위크 획득 점수", "Points scored this gameweek")
    },
    {
      key: "seasonPoints",
      label: tr("누적", "Season"),
      format: (row) => String(row.seasonPoints),
      hint: tr("시즌 누적 점수", "Season points")
    },
    {
      key: "leagueContribution",
      label: tr("리그 기여", "League pts"),
      format: (row) => String(row.leagueContribution),
      hint: tr(
        "누적 점수 × 보유 매니저 수 — 리그 전체에 뿌려진 점수",
        "Season points × owners: points handed out across the league"
      )
    },
    {
      key: "seasonSwing",
      label: tr("순위 기여", "Rank swing"),
      format: (row) => (row.seasonSwing >= 0 ? `+${row.seasonSwing}` : String(row.seasonSwing)),
      hint: tr(
        "누적 점수 × (1 − 리그 보유율) — 보유자가 리그 평균 대비 벌어놓은 점수",
        "Season points × (1 − league ownership): what owners gained on the league average"
      )
    }
  ];
}

const PREVIEW = 12;

function DotRow({
  row,
  managerNames
}: {
  row: LeaguePlayerStat;
  managerNames: string[];
}) {
  const { tr } = useLocale();
  const owners = new Set(row.owners);
  const captains = new Set(row.captains);

  return (
    <div className="grid items-center gap-2" style={{ gridTemplateColumns: "116px 1fr 58px" }}>
      <span className="truncate text-meta">
        {row.webName}
        <span className="ml-1 text-caption text-[var(--muted)]">{row.teamShortName}</span>
      </span>
      <span className="flex gap-[3px]">
        {managerNames.map((name, index) => {
          const isOwner = owners.has(index);
          const isCaptain = captains.has(index);

          return (
            <span
              key={name + index}
              title={`${name} · ${isCaptain ? tr("주장", "Captain") : isOwner ? tr("보유", "Owns") : tr("미보유", "Does not own")}`}
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
      <span className="text-right text-caption tabular-nums text-[var(--muted)]">
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
  const { tr } = useLocale();
  const columns = useMemo(() => buildColumns(tr), [tr]);
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
            {points(row)}
            {tr("점", " pts")} · {tr(`${row.ownedBy}명`, `${row.ownedBy} own`)}
          </span>
        </>
      ),
      tooltip: tr(
        `${row.webName} · ${points(row)}점 · 리그 ${row.ownedBy}/${managerCount}명 (EO ${row.effectiveOwnership}%)`,
        `${row.webName} · ${points(row)} pts · league ${row.ownedBy}/${managerCount} (EO ${row.effectiveOwnership}%)`
      ),
      onSelect: () => onSelect(row.elementId)
    }));
  }, [leaguePlayers, swingWindow, managerCount, onSelect, tr]);

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
          <h3 className="text-body-lg font-semibold">{tr("순위 상승에 기여한 선수", "Players driving the rank")}</h3>
          <p className="text-caption leading-relaxed text-[var(--muted)]">
            {tr(
              "보유자가 리그 평균 대비 벌어놓은 점수입니다. 적게 보유될수록 커지고, 전원이 가진 선수는 아무도 끌어올리지 못합니다.",
              "Points owners gained on the league average. The fewer own him the bigger it is; a player everyone has lifts nobody."
            )}
            <span className="block">
              {swingWindow === "season"
                ? tr(
                    "누적 = 시즌 점수 × (1 − 리그 보유율). 과거 라인업은 남지 않으므로 현재 스쿼드 기준입니다.",
                    "Season = season points × (1 − league ownership). Past lineups are not kept, so today's squads are used."
                  )
                : tr(
                    "이번 GW = 획득 점수 × (1 − 유효 소유율). 전원이 벤치에 앉힌 선수는 0입니다.",
                    "This GW = points × (1 − effective ownership). A player everyone benched is 0."
                  )}
            </span>
          </p>
        </div>

        <div className="mb-2 flex rounded-full border border-[var(--border)] bg-white p-0.5 text-caption">
          {(
            [
              { id: "season", label: tr("누적", "Season") },
              { id: "gw", label: tr("이번 GW", "This GW") }
            ] as const
          ).map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setSwingWindow(option.id)}
              className={`rounded-full px-3 py-1 font-semibold transition ${
                swingWindow === option.id ? "bg-[var(--accent-soft)] text-[var(--accent-ink)] shadow-[inset_0_0_0_1px_var(--accent)]" : "text-[var(--muted)]"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {swingRows.length > 0 ? (
          <div className="overflow-x-auto">
            <MagnitudeRows rows={swingRows} max={swingMax} valueWidth="148px" />
          </div>
        ) : (
          <p className="py-4 text-center text-meta text-[var(--muted)]">
            {tr("아직 이번 게임위크에 점수를 낸 보유 선수가 없습니다.", "No owned player has scored this gameweek yet.")}
          </p>
        )}
      </section>

      {summary.solo.length > 0 ? (
        <section className="rounded-[1.2rem] border border-[var(--border)] bg-[var(--surface)] p-3 shadow-[0_12px_36px_rgba(55,40,20,0.07)]">
          <div className="mb-2">
            <h3 className="text-body-lg font-semibold">
              {tr(`단독 보유 ${summary.solo.length}명`, `Owned by one manager: ${summary.solo.length}`)}
            </h3>
            <p className="text-caption text-[var(--muted)]">
              {tr("한 명만 가진 선수. 이 선수들이 리그 순위를 벌립니다.", "Players only one manager has. These open up the league table.")}
            </p>
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
                    className="flex w-full items-center justify-between gap-2 rounded-md px-1 py-1 text-left text-meta transition hover:bg-[var(--surface-strong)]/50"
                  >
                    <span className="min-w-0 truncate">
                      <span className="font-semibold">{row.webName}</span>
                      <span className="ml-1 text-caption text-[var(--muted)]">{row.teamShortName}</span>
                    </span>
                    <span className="whitespace-nowrap text-caption tabular-nums text-[var(--muted)]">
                      {managerNames[row.owners[0]] ?? "?"} · {tr(`누적 ${row.seasonPoints}점`, `${row.seasonPoints} pts this season`)}
                    </span>
                  </button>
                </li>
              ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-[1.2rem] border border-[var(--border)] bg-[var(--surface)] p-3 shadow-[0_12px_36px_rgba(55,40,20,0.07)]">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h3 className="text-body-lg font-semibold">
              {tr(`리그 보유 선수 ${leaguePlayers.length}명`, `Players owned in league: ${leaguePlayers.length}`)}
            </h3>
            <p className="text-caption text-[var(--muted)]">
              {tr(
                `${managerCount}명 전원이 가진 선수 ${summary.template.length}명 · 헤더를 눌러 정렬하고, 행을 누르면 상세가 열립니다.`,
                `${summary.template.length} players owned by all ${managerCount} managers · tap a header to sort, a row for details.`
              )}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[620px] w-full border-collapse text-meta">
            <thead>
              <tr className="border-b border-[var(--border)] text-caption uppercase tracking-[0.08em] text-[var(--muted)]">
                <th className="px-2 py-2 text-left">{tr("선수", "Player")}</th>
                {columns.map((column) => {
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
                    <span className="ml-1 text-caption text-[var(--muted)]">
                      {row.teamShortName} · {row.position} · {formatMoney(row.cost)}
                    </span>
                  </td>
                  {columns.map((column) => (
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
            className="mx-auto mt-2 flex items-center gap-1 text-caption text-[var(--muted)] transition hover:text-[var(--text)]"
          >
            {expanded ? tr("접기", "Show less") : tr(`${sorted.length - PREVIEW}명 더 보기`, `Show ${sorted.length - PREVIEW} more`)}
            <CaretDown className={expanded ? "rotate-180" : ""} />
          </button>
        ) : null}
      </section>

      <section className="rounded-[1.2rem] border border-[var(--border)] bg-[var(--surface)] p-3 shadow-[0_12px_36px_rgba(55,40,20,0.07)]">
        <div className="mb-2">
          <h3 className="text-body-lg font-semibold">{tr("누가 갖고 있나", "Who owns whom")}</h3>
          <p className="text-caption text-[var(--muted)]">
            {tr(
              "가장 많이 보유된 선수 6명. 세로로 훑으면 한 매니저가 템플릿에서 얼마나 벗어나 있는지 보입니다.",
              "The six most-owned players. Read down a column to see how far one manager strays from the template."
            )}
          </p>
        </div>
        <div className="overflow-x-auto">
          <div className="flex min-w-[460px] flex-col gap-1.5">
            {matrixRows.map((row) => (
              <DotRow key={row.elementId} row={row} managerNames={managerNames} />
            ))}
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-3 text-caption text-[var(--muted)]">
          <span className="flex items-center gap-1">
            <span className="h-[11px] w-[11px] rounded-full border-[1.5px] border-[var(--chart-in)] bg-[var(--chart-in)]" />
            {tr("보유", "Owns")}
          </span>
          <span className="flex items-center gap-1">
            <span className="h-[11px] w-[11px] rounded-full border-[1.5px] border-[var(--text)] bg-[var(--chart-in)]" />
            {tr("주장", "Captain")}
          </span>
          <span className="flex items-center gap-1">
            <span className="h-[11px] w-[11px] rounded-full border-[1.5px] border-[var(--chart-mute-soft)]" />
            {tr("미보유", "Does not own")}
          </span>
        </div>
      </section>

    </div>
  );
}
