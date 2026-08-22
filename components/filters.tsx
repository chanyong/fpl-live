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
    <div className="flex flex-col gap-2 rounded-[1.25rem] border border-[var(--border)] bg-[var(--surface)] p-2.5 md:flex-row md:items-center md:gap-3 md:rounded-[1.75rem] md:p-4">
      <input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="매니저 또는 팀 이름 검색"
        aria-label="매니저 또는 팀 이름 검색"
        className="min-h-11 w-full flex-1 rounded-full border border-[var(--border)] bg-white px-4 text-[15px] outline-none focus:border-[var(--accent)] md:text-sm"
      />
      <div className="flex items-center justify-between gap-3 md:justify-start">
        <label className="flex items-center gap-2 text-[13px] text-[var(--muted)] md:text-sm">
          <input
            type="checkbox"
            checked={chipOnly}
            onChange={(event) => setChipOnly(event.target.checked)}
          />
          칩 사용만
        </label>
        <select
          value={topN}
          onChange={(event) => setTopN(event.target.value)}
          aria-label="표시 범위"
          className="min-h-11 rounded-full border border-[var(--border)] bg-white px-4 text-[15px] outline-none focus:border-[var(--accent)] md:text-sm"
        >
          <option value="all">전체</option>
          <option value="10">상위 10</option>
          <option value="20">상위 20</option>
          <option value="50">상위 50</option>
        </select>
      </div>
    </div>
  );
}
