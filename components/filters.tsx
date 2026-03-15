"use client";

type FiltersProps = {
  search: string;
  setSearch: (value: string) => void;
  chipOnly: boolean;
  setChipOnly: (value: boolean) => void;
  topN: string;
  setTopN: (value: string) => void;
};

export function Filters({
  search,
  setSearch,
  chipOnly,
  setChipOnly,
  topN,
  setTopN
}: FiltersProps) {
  return (
    <div className="flex flex-col gap-3 rounded-[1.75rem] border border-[var(--border)] bg-[var(--surface)] p-3 md:flex-row md:items-center md:p-4">
      <input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search manager or team"
        className="min-h-11 w-full flex-1 rounded-full border border-[var(--border)] bg-white px-4 outline-none focus:border-[var(--accent)]"
      />
      <div className="flex items-center justify-between gap-3 md:justify-start">
        <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
          <input
            type="checkbox"
            checked={chipOnly}
            onChange={(event) => setChipOnly(event.target.checked)}
          />
          Chip used
        </label>
        <select
          value={topN}
          onChange={(event) => setTopN(event.target.value)}
          className="min-h-11 rounded-full border border-[var(--border)] bg-white px-4 outline-none focus:border-[var(--accent)]"
        >
          <option value="all">ALL</option>
          <option value="10">Top 10</option>
          <option value="20">Top 20</option>
          <option value="50">Top 50</option>
        </select>
      </div>
    </div>
  );
}
