"use client";

import { useLocale } from "@/components/locale-provider";

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
  const { tr } = useLocale();
  return (
    <div className="flex flex-col gap-1.5 rounded-[1.2rem] border border-[var(--border)] bg-[var(--surface)] p-2 md:flex-row md:items-center md:gap-2 md:p-2.5">
      <input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder={tr("매니저 또는 팀 이름 검색", "Search manager or team")}
        aria-label={tr("매니저 또는 팀 이름 검색", "Search manager or team")}
        className="min-h-10 w-full flex-1 rounded-full border border-[var(--border)] bg-white px-4 text-body-lg outline-none focus:border-[var(--accent)] md:pointer-fine:text-body"
      />
      <div className="flex items-center justify-between gap-3 md:justify-start">
        <label className="flex items-center gap-2 text-meta text-[var(--muted)] md:text-body">
          <input
            type="checkbox"
            checked={chipOnly}
            onChange={(event) => setChipOnly(event.target.checked)}
          />
          {tr("칩 사용만", "Chip users only")}
        </label>
        <select
          value={topN}
          onChange={(event) => setTopN(event.target.value)}
          aria-label={tr("표시 범위", "Rows shown")}
          className="min-h-10 rounded-full border border-[var(--border)] bg-white px-4 text-body-lg outline-none focus:border-[var(--accent)] md:pointer-fine:text-body"
        >
          <option value="all">{tr("전체", "All")}</option>
          <option value="10">{tr("상위 10", "Top 10")}</option>
          <option value="20">{tr("상위 20", "Top 20")}</option>
          <option value="50">{tr("상위 50", "Top 50")}</option>
        </select>
      </div>
    </div>
  );
}
