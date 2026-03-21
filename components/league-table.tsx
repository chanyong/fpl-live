"use client";

import { Fragment, useMemo, useState } from "react";
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
import { LeagueRow, LeagueRowExpanded } from "@/components/league-row";

const columnHelper = createColumnHelper<LeagueRowType>();

const columns = [
  columnHelper.accessor("projectedRank", { header: "Rank" }),
  columnHelper.accessor("teamName", { header: "Team" }),
  columnHelper.accessor("managerName", { header: "Manager" }),
  columnHelper.accessor("captainName", { header: "Captain" }),
  columnHelper.accessor("chip", { header: "Chip" }),
  columnHelper.accessor("playersPlayed", { header: "Players Played" }),
  columnHelper.accessor("gwPoints", { header: "GW Points" }),
  columnHelper.accessor("totalPoints", { header: "Total" })
];

function chipLabel(chip: LeagueRowType["chip"]) {
  if (!chip) {
    return "-";
  }

  return (
    {
      "3xc": "TC",
      bboost: "BB",
      freehit: "FH",
      wildcard: "WC",
      manager: "MGR"
    }[chip] ?? chip
  );
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
                <th className="w-[32px] px-1 py-2 text-left">Rank</th>
                <th className="px-1 py-2 text-left">Team</th>
                <th className="px-1 py-2 text-left">Captain</th>
                <th className="w-[44px] px-1 py-2 text-right">GW</th>
                <th className="w-[50px] px-1 py-2 text-right">Total</th>
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
                      className="cursor-pointer border-b border-[var(--border)] bg-white align-top"
                      onClick={() => setExpandedId((current) => (current === row.entryId ? null : row.entryId))}
                    >
                      <td className="px-1 py-2.5 align-top">
                        <div className="flex items-center gap-1 font-semibold tabular-nums text-stone-800">
                          <span className="text-[10px] text-[var(--muted)]">{isExpanded ? "v" : ">"}</span>
                          <span>{row.projectedRank}</span>
                        </div>
                      </td>
                      <td className="px-1 py-2.5 align-top">
                        <div className="truncate text-[13px] font-semibold leading-4">{row.teamName}</div>
                        <div className="mt-0.5 truncate text-[10px] leading-4 text-[var(--muted)]">{row.managerName}</div>
                      </td>
                      <td className="px-1 py-2.5 align-top">
                        <div className="truncate text-[13px] font-semibold leading-4">{row.captainName}</div>
                        <div className="mt-0.5 truncate text-[10px] leading-4 text-[var(--muted)]">
                          {row.chip ? chipLabel(row.chip) : `${row.playersPlayed} played`}
                        </div>
                      </td>
                      <td className={`px-1 py-2.5 text-right align-top font-semibold tabular-nums ${tone}`}>{row.gwPoints}</td>
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
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="px-2.5 py-3 text-left text-[12px] font-semibold">
                    {header.isPlaceholder ? null : (
                      <button
                        type="button"
                        className="flex items-center gap-1.5"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {{ asc: "^", desc: "v" }[header.column.getIsSorted() as string] ?? "+"}
                      </button>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((tableRow) => {
              const isExpanded = expandedId === tableRow.original.entryId;
              const tone = gwClassName(tableRow.original, gwTone.lowCut, gwTone.highCut);

              return (
                <Fragment key={tableRow.original.entryId}>
                  <tr
                    className="cursor-pointer border-b border-[var(--border)] bg-white transition hover:bg-stone-50"
                    onClick={() =>
                      setExpandedId((current) =>
                        current === tableRow.original.entryId ? null : tableRow.original.entryId
                      )
                    }
                  >
                    <LeagueRow row={tableRow.original} gwClassName={tone} />
                  </tr>
                  {isExpanded ? (
                    <tr className="bg-[var(--surface-strong)]/40">
                      <td colSpan={8} className="px-2.5 py-2.5">
                        <LeagueRowExpanded row={tableRow.original} />
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
