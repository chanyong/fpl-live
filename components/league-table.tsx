"use client";

import { Fragment, useMemo, useState, type KeyboardEvent } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState
} from "@tanstack/react-table";
import type { LeagueLiveResponse, LeagueRow as LeagueRowType } from "@/lib/types";
import { Filters } from "@/components/filters";
import { CaretDown, CaretRight, CaretUp, SortToggle } from "@/components/icons";
import { GwPoints, LeagueRow, LeagueRowExpanded } from "@/components/league-row";
import { chipLabel } from "@/lib/chips";
import { RankDelta } from "@/components/rank-delta";
import { SquadCompareDialog } from "@/components/squad-compare-dialog";
import { useLocale } from "@/components/locale-provider";

const columnHelper = createColumnHelper<LeagueRowType>();

/** Columns that only hold a short value shrink to fit, leaving the slack to the name columns. */
const NARROW_COLUMNS = new Set(["projectedRank", "movement", "chip", "playersPlayed", "gwPoints", "totalPoints"]);

function buildColumns(tr: <T = string>(ko: T, en: T) => T) {
  return [
    columnHelper.accessor("projectedRank", { header: tr("순위", "Rank") }),
    columnHelper.display({ id: "movement", header: tr("변동", "Move") }),
    columnHelper.accessor("teamName", { header: tr("팀", "Team") }),
    columnHelper.accessor("managerName", { header: tr("매니저", "Manager") }),
    columnHelper.accessor("captainName", { header: tr("주장", "Captain") }),
    columnHelper.accessor("chip", { header: tr("칩", "Chip") }),
    columnHelper.accessor("playersPlayed", { header: tr("출전", "Played") }),
    columnHelper.accessor("gwPoints", { header: tr("GW 점수", "GW pts") }),
    columnHelper.accessor("totalPoints", { header: tr("총점", "Total") })
  ];
}

function buildRankTone(rows: LeagueRowType[]) {
  if (rows.length === 0) {
    return { lowCut: 0, highCut: 0 };
  }

  const scores = rows.map((row) => row.gwPoints).sort((a, b) => a - b);
  const lowCut = scores[Math.floor((scores.length - 1) / 3)] ?? scores[0] ?? 0;
  const highCut = scores[Math.floor(((scores.length - 1) * 2) / 3)] ?? scores[scores.length - 1] ?? 0;

  return { lowCut, highCut };
}

function gwClassName(row: LeagueRowType, lowCut: number, highCut: number) {
  if (row.gwPoints >= highCut) {
    return "text-emerald-700";
  }

  if (row.gwPoints <= lowCut) {
    return "text-rose-700";
  }

  return "text-amber-700";
}

export function LeagueTable({ data }: { data: LeagueLiveResponse }) {
  const { tr, locale } = useLocale();
  const [sorting, setSorting] = useState<SortingState>([{ id: "projectedRank", desc: false }]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [chipOnly, setChipOnly] = useState(false);
  const [topN, setTopN] = useState("all");
  const columns = useMemo(() => buildColumns(tr), [tr]);
  const [quick, setQuick] = useState<"all" | "up" | "down">("all");
  const [compareMode, setCompareMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);

  const quickCounts = useMemo(
    () => ({
      all: data.rows.length,
      up: data.rows.filter((row) => row.projectedRank < row.rank).length,
      down: data.rows.filter((row) => row.projectedRank > row.rank).length
    }),
    [data.rows]
  );

  const filteredRows = useMemo(() => {
    return data.rows.filter((row) => {
      const matchesQuick =
        quick === "all"
          ? true
          : quick === "up"
            ? row.projectedRank < row.rank
            : row.projectedRank > row.rank;

      const matchesSearch =
        row.managerName.toLowerCase().includes(search.toLowerCase()) ||
        row.teamName.toLowerCase().includes(search.toLowerCase());
      const matchesChip = chipOnly ? Boolean(row.chip) : true;
      const matchesTopN = topN === "all" ? true : row.projectedRank <= Number(topN);

      return matchesSearch && matchesChip && matchesTopN && matchesQuick;
    });
  }, [chipOnly, data.rows, quick, search, topN]);

  const gwTone = useMemo(() => buildRankTone(data.rows), [data.rows]);

  const table = useReactTable({
    data: filteredRows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel()
  });

  const toggle = (entryId: number) =>
    setExpandedId((current) => (current === entryId ? null : entryId));

  // A third pick pushes out the oldest one, so two are always one tap away.
  const toggleSelected = (entryId: number) =>
    setSelectedIds((current) =>
      current.includes(entryId)
        ? current.filter((id) => id !== entryId)
        : [...current, entryId].slice(-2)
    );

  const exitCompareMode = () => {
    setCompareMode(false);
    setSelectedIds([]);
    setCompareOpen(false);
  };

  const selectedRows = selectedIds
    .map((id) => data.rows.find((row) => row.entryId === id))
    .filter((row): row is LeagueRowType => Boolean(row));

  // The row is the control, so it has to answer to the keyboard as well as the mouse.
  const rowProps = (entryId: number, isExpanded: boolean) => {
    const activate = () => (compareMode ? toggleSelected(entryId) : toggle(entryId));

    return {
      role: "button" as const,
      tabIndex: 0,
      ...(compareMode
        ? { "aria-pressed": selectedIds.includes(entryId) }
        : { "aria-expanded": isExpanded }),
      onClick: activate,
      onKeyDown: (event: KeyboardEvent<HTMLTableRowElement>) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          activate();
        }
      }
    };
  };

  const selectMark = (entryId: number) => {
    if (!compareMode) {
      return null;
    }

    const order = selectedIds.indexOf(entryId);

    return (
      <span
        aria-hidden="true"
        className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border text-caption font-bold ${
          order >= 0
            ? "border-[var(--accent)] bg-[var(--accent)] text-white"
            : "border-[var(--border)] bg-[var(--bg)] text-transparent"
        }`}
      >
        {order >= 0 ? order + 1 : "·"}
      </span>
    );
  };

  const rowSelectedClass = (entryId: number) =>
    compareMode && selectedIds.includes(entryId) ? "bg-[var(--accent-soft)]" : "bg-[var(--bg)]";

  if (filteredRows.length === 0) {
    return (
      <div className="space-y-2 md:space-y-3">
        <Filters
          search={search}
          setSearch={setSearch}
          chipOnly={chipOnly}
          setChipOnly={setChipOnly}
          topN={topN}
          setTopN={setTopN}
        />
        <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-10 text-center text-body text-[var(--muted)]">
          {tr("일치하는 매니저가 없습니다.", "No managers match.")}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 md:space-y-3">
      <Filters
        search={search}
        setSearch={setSearch}
        chipOnly={chipOnly}
        setChipOnly={setChipOnly}
        topN={topN}
        setTopN={setTopN}
      />

      <div className="flex flex-wrap items-center justify-between gap-1.5">
        {compareMode ? (
          <p className="text-caption text-[var(--muted)] md:text-meta">
            {tr("비교할 매니저 2명을 선택하세요.", "Pick two managers to compare.")}
          </p>
        ) : (
          <div role="group" aria-label={tr("순위 변동 필터", "Rank movement filter")} className="flex flex-wrap gap-1.5">
            {(
              [
                { id: "all", label: tr("전체", "All"), count: quickCounts.all },
                { id: "up", label: tr("▲ 상승", "▲ Up"), count: quickCounts.up },
                { id: "down", label: tr("▼ 하락", "▼ Down"), count: quickCounts.down }
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={quick === item.id}
                onClick={() => setQuick(item.id)}
                className={`min-h-9 shrink-0 whitespace-nowrap rounded-md border px-2.5 text-meta font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                  quick === item.id
                    ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-ink)]"
                    : "border-[var(--border)] bg-[var(--bg)] text-[var(--muted)] hover:border-[var(--accent)]"
                }`}
              >
                {item.label} <span className="tabular-nums">{item.count}</span>
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          aria-pressed={compareMode}
          onClick={() => (compareMode ? exitCompareMode() : setCompareMode(true))}
          className={`min-h-9 shrink-0 rounded-md border px-3 text-body font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
            compareMode
              ? "border-[var(--accent)] bg-[var(--accent)] text-white"
              : "border-[var(--border)] bg-[var(--bg)] text-[var(--text)] hover:border-[var(--accent)]"
          }`}
        >
          {compareMode ? tr("비교 종료", "Exit compare") : tr("스쿼드 비교", "Compare squads")}
        </button>
      </div>

      <div className="overflow-hidden rounded-md border border-[var(--border)] bg-[var(--surface)] md:hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-caption">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface-strong)]/40 text-caption uppercase tracking-[0.08em] text-[var(--muted)]">
                <th className="w-[48px] px-1 py-2 text-left">{tr("순위", "Rank")}</th>
                <th className="px-1 py-2 text-left">{tr("팀", "Team")}</th>
                <th className="px-1 py-2 text-left">{tr("주장", "Captain")}</th>
                <th className="w-[48px] px-1 py-2 text-right">GW</th>
                <th className="w-[50px] px-1 py-2 text-right">{tr("총점", "Total")}</th>
              </tr>
            </thead>
            <tbody>
              {table.getRowModel().rows.map((tableRow) => {
                const row = tableRow.original;
                const isExpanded = expandedId === row.entryId;
                const tone = gwClassName(row, gwTone.lowCut, gwTone.highCut);

                return (
                  <Fragment key={row.entryId}>
                    <tr
                      className={`cursor-pointer border-b border-[var(--border)] align-top focus:outline-none focus-visible:bg-[var(--accent-soft)] ${rowSelectedClass(row.entryId)}`}
                      {...rowProps(row.entryId, isExpanded)}
                    >
                      <td className="px-1 py-1.5 align-top">
                        <div className="flex items-center gap-1 text-body font-semibold leading-4 tabular-nums text-stone-800">
                          {compareMode ? (
                            selectMark(row.entryId)
                          ) : (
                            <span className="text-[var(--muted)]">
                              {isExpanded ? <CaretDown /> : <CaretRight />}
                            </span>
                          )}
                          <span>{row.projectedRank}</span>
                        </div>
                        <div className="mt-0.5 pl-4 text-caption">
                          <RankDelta from={row.rank} to={row.projectedRank} />
                        </div>
                      </td>
                      <td className="px-1 py-1.5 align-top">
                        <div className="truncate text-meta font-semibold leading-4">{row.teamName}</div>
                        <div className="mt-0.5 truncate text-caption leading-4 text-[var(--muted)]">{row.managerName}</div>
                      </td>
                      <td className="px-1 py-1.5 align-top">
                        <div className="truncate text-meta font-semibold leading-4">{row.captainName}</div>
                        <div className="mt-0.5 truncate text-caption leading-4 text-[var(--muted)]">
                          {row.chip ? chipLabel(row.chip, true, locale) : tr(`${row.playersPlayed}명 출전`, `${row.playersPlayed} played`)}
                        </div>
                      </td>
                      <td className={`px-1 py-1.5 text-right align-top text-body font-semibold leading-4 ${tone}`}>
                        <GwPoints row={row} />
                      </td>
                      <td className="px-1 py-1.5 text-right align-top text-body font-semibold leading-4 tabular-nums">{row.totalPoints}</td>
                    </tr>
                    {isExpanded && !compareMode ? (
                      <tr className="bg-[var(--surface-strong)]/30">
                        <td colSpan={5} className="px-1 py-2">
                          <LeagueRowExpanded row={row} gw={data.league.currentGw} />
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="hidden overflow-x-auto rounded-md border border-[var(--border)] bg-[var(--surface)] md:block">
        <table className="min-w-full border-collapse text-body">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-[var(--border)] bg-[var(--surface-strong)]/50">
                {headerGroup.headers.map((header) => {
                  const sorted = header.column.getIsSorted();

                  return (
                    <th
                      key={header.id}
                      className={`px-2.5 py-2 text-left text-caption font-semibold ${
                        NARROW_COLUMNS.has(header.column.id) ? "w-px whitespace-nowrap" : ""
                      }`}
                    >
                      {header.isPlaceholder ? null : header.column.getCanSort() ? (
                        <button
                          type="button"
                          className="flex items-center gap-1.5 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {sorted === "asc" ? <CaretUp /> : sorted === "desc" ? <CaretDown /> : <SortToggle />}
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((tableRow) => {
              const row = tableRow.original;
              const isExpanded = expandedId === row.entryId;
              const tone = gwClassName(row, gwTone.lowCut, gwTone.highCut);

              return (
                <Fragment key={row.entryId}>
                  <tr
                    className={`cursor-pointer border-b border-[var(--border)] transition hover:bg-stone-50 focus:outline-none focus-visible:bg-[var(--accent-soft)] ${rowSelectedClass(row.entryId)}`}
                    {...rowProps(row.entryId, isExpanded)}
                  >
                    <LeagueRow row={row} gwClassName={tone} selectMark={selectMark(row.entryId)} />
                  </tr>
                  {isExpanded && !compareMode ? (
                    <tr className="bg-[var(--surface-strong)]/40">
                      <td colSpan={9} className="px-2.5 py-1.5">
                        <LeagueRowExpanded row={row} gw={data.league.currentGw} />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {compareMode ? (
        <div className="sticky bottom-3 z-40 flex items-center justify-between gap-3 rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-2">
          <div className="min-w-0 truncate text-body">
            {selectedRows.length === 0
              ? tr("0/2 선택", "0/2 selected")
              : selectedRows.map((row) => row.teamName).join(" vs ")}
          </div>
          <button
            type="button"
            disabled={selectedRows.length < 2}
            onClick={() => setCompareOpen(true)}
            className="min-h-10 shrink-0 rounded-md bg-[var(--accent)] px-4 text-body font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {tr("비교하기", "Compare")} ({selectedRows.length}/2)
          </button>
        </div>
      ) : null}

      {compareOpen && selectedRows.length === 2 ? (
        <SquadCompareDialog
          a={selectedRows[0]}
          b={selectedRows[1]}
          onClose={() => setCompareOpen(false)}
        />
      ) : null}
    </div>
  );
}
