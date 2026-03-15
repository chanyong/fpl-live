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
  columnHelper.accessor("rank", { header: "Rank" }),
  columnHelper.accessor("teamName", { header: "Team" }),
  columnHelper.accessor("managerName", { header: "Manager" }),
  columnHelper.accessor("captainName", { header: "Captain" }),
  columnHelper.accessor("chip", { header: "Chip" }),
  columnHelper.accessor("playersPlayed", { header: "Players Played" }),
  columnHelper.accessor("gwPoints", { header: "GW Points" }),
  columnHelper.accessor("totalPoints", { header: "Total" }),
  columnHelper.accessor("projectedRank", { header: "Projected Rank" })
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

export function LeagueTable({ data }: { data: LeagueLiveResponse }) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "rank", desc: false }]);
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
      const matchesTopN = topN === "all" ? true : row.rank <= Number(topN);

      return matchesSearch && matchesChip && matchesTopN;
    });
  }, [chipOnly, data.rows, search, topN]);

  const table = useReactTable({
    data: filteredRows,
    columns,
    state: {
      sorting
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel()
  });

  return (
    <div className="space-y-4">
      <Filters
        search={search}
        setSearch={setSearch}
        chipOnly={chipOnly}
        setChipOnly={setChipOnly}
        topN={topN}
        setTopN={setTopN}
      />

      <div className="grid gap-3 md:hidden">
        {table.getRowModel().rows.map((tableRow) => {
          const row = tableRow.original;
          const isExpanded = expandedId === row.entryId;

          return (
            <div
              key={row.entryId}
              className="overflow-hidden rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface)] shadow-[0_18px_40px_rgba(55,40,20,0.08)]"
            >
              <button
                type="button"
                className="w-full px-4 py-4 text-left"
                onClick={() => setExpandedId((current) => (current === row.entryId ? null : row.entryId))}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                      <span>Rank {row.rank}</span>
                      <span>Proj {row.projectedRank}</span>
                      {row.chip ? <span className="rounded-full bg-[var(--accent-soft)] px-2 py-1 text-[var(--accent)]">{chipLabel(row.chip)}</span> : null}
                    </div>
                    <div className="mt-2 truncate text-lg font-semibold">{row.teamName}</div>
                    <div className="truncate text-sm text-[var(--muted)]">{row.managerName}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-semibold tabular-nums">{row.gwPoints}</div>
                    <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">GW pts</div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
                  <div className="rounded-2xl bg-white px-3 py-2">
                    <div className="text-[var(--muted)]">Played</div>
                    <div className="mt-1 font-semibold tabular-nums">{row.playersPlayed}</div>
                  </div>
                  <div className="rounded-2xl bg-white px-3 py-2">
                    <div className="text-[var(--muted)]">Total</div>
                    <div className="mt-1 font-semibold tabular-nums">{row.totalPoints}</div>
                  </div>
                  <div className="rounded-2xl bg-white px-3 py-2">
                    <div className="text-[var(--muted)]">Captain</div>
                    <div className="mt-1 truncate font-semibold">{row.captainName}</div>
                  </div>
                </div>

                {row.provisional ? (
                  <div className="mt-3 text-xs uppercase tracking-[0.18em] text-[var(--warning)]">
                    Provisional live score
                  </div>
                ) : null}
              </button>
              {isExpanded ? (
                <div className="border-t border-[var(--border)] bg-[var(--surface-strong)]/35 px-4 py-4">
                  <LeagueRowExpanded row={row} />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="hidden overflow-x-auto rounded-[1.75rem] border border-[var(--border)] bg-[var(--surface)] shadow-[0_20px_80px_rgba(55,40,20,0.08)] md:block">
        <table className="min-w-full border-collapse">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr
                key={headerGroup.id}
                className="border-b border-[var(--border)] bg-[var(--surface-strong)]/50"
              >
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-4 text-left text-sm font-semibold"
                  >
                    {header.isPlaceholder ? null : (
                      <button
                        type="button"
                        className="flex items-center gap-2"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                        {{ asc: "↑", desc: "↓" }[header.column.getIsSorted() as string] ?? "↕"}
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
                    <LeagueRow row={tableRow.original} />
                  </tr>
                  {isExpanded ? (
                    <tr className="bg-[var(--surface-strong)]/40">
                      <td colSpan={9} className="px-4 py-4">
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
