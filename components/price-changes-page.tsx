"use client";

import { LocaleToggle, useLocale } from "@/components/locale-provider";
import { PriceChangesSection } from "@/components/price-changes-section";
import { SiteHeader } from "@/components/site-header";

export function PriceChangesPage() {
  const { tr } = useLocale();

  return (
    <main className="page-shell gap-3">
      <SiteHeader>
        <LocaleToggle />
      </SiteHeader>
      <header>
        <h1 className="text-2xl font-semibold leading-tight md:text-3xl">
          {tr("FPL 가격 변동 예측", "FPL price change predictions")}
        </h1>
        <p className="mt-1 text-body text-[var(--muted)]">
          {tr("이번 마감 전 오를·내릴 선수", "Who rises or falls before the deadline")}
        </p>
      </header>

      <PriceChangesSection onSelect={() => undefined} />
    </main>
  );
}
