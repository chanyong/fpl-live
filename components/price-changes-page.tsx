"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { LocaleToggle, useLocale } from "@/components/locale-provider";
import { PriceChangesSection } from "@/components/price-changes-section";
import type { PlayerStat } from "@/lib/types";

async function fetchPrices(fallbackError: string) {
  const response = await fetch("/api/price-changes");

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? fallbackError);
  }

  return ((await response.json()) as { players: PlayerStat[] }).players;
}

export function PriceChangesPage() {
  const { tr } = useLocale();
  const query = useQuery({
    queryKey: ["price-changes"],
    queryFn: () => fetchPrices(tr("가격 데이터를 불러오지 못했습니다.", "Could not load price data.")),
    refetchInterval: 60_000
  });

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-3 px-2 py-3 md:px-4">
      <div className="flex items-center justify-end gap-2">
        <Link
          href="/"
          className="inline-flex shrink-0 items-center rounded-full border border-[var(--border)] bg-white px-3.5 py-1.5 text-[12px] font-semibold text-[var(--text)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
        >
          {tr("내 리그 보기", "Open my league")}
        </Link>
        <LocaleToggle />
      </div>
      <header>
        <h1 className="text-2xl font-semibold leading-tight md:text-3xl">
          {tr("FPL 가격 변동 예측", "FPL price change predictions")}
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {tr(
            "이번 마감 전 오를 선수와 내릴 선수를 공식 FPL 데이터로 확인하세요. 로그인도 리그 ID도 필요 없습니다.",
            "See who is about to rise or fall before the deadline, from official FPL data. No login or league ID needed."
          )}
        </p>
      </header>

      {query.isLoading ? <div className="h-64 animate-pulse rounded-2xl border border-[var(--border)] bg-[var(--surface)]/80" /> : null}
      {query.error ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-[var(--danger)]">
          {(query.error as Error).message}
        </div>
      ) : null}
      {query.data ? <PriceChangesSection players={query.data} onSelect={() => undefined} /> : null}
    </main>
  );
}
