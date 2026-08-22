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

const columnHelper = createColumnHelper<LeagueRowType>();

const columns = [
  columnHelper.accessor("projectedRank", { header: "순위" }),
  columnHelper.display({ id: "movement", header: "변동" }),
  columnHelper.accessor("teamName", { header: "팀" }),
  columnHelper.accessor("managerName", { header: "매니저" }),
  columnHelper.accessor("captainName", { header: "주장" }),
  columnHelper.accessor("chip", { header: "칩" }),
  columnHelper.accessor("playersPlayed", { header: "출전" }),
  columnHelper.accessor("gwPoints", { header: "GW 점수" }),
  columnHelper.accessor("totalPoints", { header: "총점" })
];

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
  const [sorting, setSorting] = useState<SortingState>([{ id: "projectedRank", desc: false }]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [chipOnly, setChipOnly] = useState(false);
  const [topN, setTopN] = useState("all");

  const filteredRows = useMemo(() => {
    return data.rows.filter((row) => {
      const matchesSearch =
        row.managerName.toLowerCase().includes(search.toLowerCase()) ||
        row.teamName.toLowerCase().includes(search.toLowerCase());
      const matchesChip = chipOnly ? Boolean(row.chip) : true;
      const matchesTopN = topN === "all" ? true : row.projectedRank <= Number(topN);

      return matchesSearch && matchesChip && matchesTopN;
    });
  }, [chipOnly, data.rows, search, topN]);

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

  // The row is the control, so it has to answer to the keyboard as well as the mouse.
  const rowProps = (entryId: number, isExpanded: boolean) => ({
    role: "button" as const,
    tabIndex: 0,
    "aria-expanded": isExpanded,
    onClick: () => toggle(entryId),
    onKeyDown: (event: KeyboardEvent<HTMLTableRowElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggle(entryId);
      }
    }
  });

  if (filteredRows.length === 0) {
    return (
      <div className="space-y-3 md:space-y-4">
        <Filters
          search={search}
          setSearch={setSearch}
          chipOnly={chipOnly}
          setChipOnly={setChipOnly}
          topN={topN}
          setTopN={setTopN}
        />
        <div className="rounded-[1.2rem] border border-[var(--border)] bg-[var(--surface)] px-4 py-10 text-center text-sm text-[var(--muted)]">
          조건에 맞는 매니저가 없습니다. 검색어나 필터를 바꿔 보세요.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 md:space-y-4">
      <Filters
        search={search}
        setSearch={setSearch}
        chipOnly={chipOnly}
        setChipOnly={setChipOnly}
        topN={topN}
        setTopN={setTopN}
      />

      <div className="overflow-hidden rounded-[1.2rem] border border-[var(--border)] bg-[var(--surface)] shadow-[0_14px_32px_rgba(55,40,20,0.08)] md:hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-[12px]">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface-strong)]/40 text-[10px] uppercase tracking-[0.08em] text-[var(--muted)]">
                <th className="w-[48px] px-1 py-2 text-left">순위</th>
                <th className="px-1 py-2 text-left">팀</th>
                <th className="px-1 py-2 text-left">주장</th>
                <th className="w-[48px] px-1 py-2 text-right">GW</th>
                <th className="w-[50px] px-1 py-2 text-right">총점</th>
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
                      className="cursor-pointer border-b border-[var(--border)] bg-white align-top focus:outline-none focus-visible:bg-[var(--accent-soft)]"
                      {...rowProps(row.entryId, isExpanded)}
                    >
                      <td className="px-1 py-2.5 align-top">
                        <div className="flex items-center gap-1 font-semibold tabular-nums text-stone-800">
                          <span className="text-[var(--muted)]">
                            {isExpanded ? <CaretDown /> : <CaretRight />}
                          </span>
                          <span>{row.projectedRank}</span>
                        </div>
                        <div className="mt-0.5 pl-4 text-[10px]">
                          <RankDelta from={row.rank} to={row.projectedRank} />
                        </div>
                      </td>
                      <td className="px-1 py-2.5 align-top">
                        <div className="truncate text-[13px] font-semibold leading-4">{row.teamName}</div>
                        <div className="mt-0.5 truncate text-[10px] leading-4 text-[var(--muted)]">{row.managerName}</div>
                      </td>
                      <td className="px-1 py-2.5 align-top">
                        <div className="truncate text-[13px] font-semibold leading-4">{row.captainName}</div>
                        <div className="mt-0.5 truncate text-[10px] leading-4 text-[var(--muted)]">
                          {row.chip ? chipLabel(row.chip, true) : `${row.playersPlayed}명 출전`}
                        </div>
                      </td>
                      <td className={`px-1 py-2.5 text-right align-top font-semibold ${tone}`}>
                        <GwPoints row={row} />
                      </td>
                      <td className="px-1 py-2.5 text-right align-top font-semibold tabular-nums">{row.totalPoints}</td>
                    </tr>
                    {isExpanded ? (
                      <tr className="bg-[var(--surface-strong)]/30">
                        <td colSpan={5} className="px-1 py-2">
                          <LeagueRowExpanded row={row} />
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

      <div className="hidden overflow-x-auto rounded-[1.2rem] border border-[var(--border)] bg-[var(--surface)] shadow-[0_12px_36px_rgba(55,40,20,0.07)] md:block">
        <table className="min-w-full border-collapse text-[14px]">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-[var(--border)] bg-[var(--surface-strong)]/50">
                {headerGroup.headers.map((header) => {
                  const sorted = header.column.getIsSorted();

                  return (
                    <th key={header.id} className="px-2.5 py-3 text-left text-[12px] font-semibold">
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
                    className="cursor-pointer border-b border-[var(--border)] bg-white transition hover:bg-stone-50 focus:outline-none focus-visible:bg-[var(--accent-soft)]"
                    {...rowProps(row.entryId, isExpanded)}
                  >
                    <LeagueRow row={row} gwClassName={tone} />
                  </tr>
                  {isExpanded ? (
                    <tr className="bg-[var(--surface-strong)]/40">
                      <td colSpan={9} className="px-2.5 py-2.5">
                        <LeagueRowExpanded row={row} />
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
  );
}
