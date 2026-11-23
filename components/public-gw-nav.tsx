"use client";

import Link from "next/link";
import { useLocale } from "@/components/locale-provider";
import { PUBLIC_PAGES } from "@/lib/public-pages";

/**
 * Previous / next gameweek buttons of the top-menu fixtures page. Plain links to `?gw=N` so each gameweek has
 * its own address and is drawn on the server. The current gameweek's address carries no query.
 */
export function PublicGwNav({ gw, firstGw, lastGw, currentGw }: { gw: number; firstGw: number; lastGw: number; currentGw: number }) {
  const { tr } = useLocale();
  const labels = {
    prev: tr("← 지난 GW", "← Previous GW"),
    next: tr("다음 GW →", "Next GW →"),
    current: tr("이번 GW", "This GW")
  };
  const href = (target: number) => (target === currentGw ? PUBLIC_PAGES.fixtures.path : `${PUBLIC_PAGES.fixtures.path}?gw=${target}`);
  const button =
    "inline-flex min-h-9 items-center rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 text-caption font-semibold transition hover:border-[var(--accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]";
  const off = "inline-flex min-h-9 items-center rounded-md border border-[var(--border)] px-3 text-caption font-semibold text-[var(--muted)] opacity-50";

  return (
    <nav aria-label="Gameweek" className="flex flex-wrap items-center gap-1.5">
      {gw > firstGw ? (
        <Link href={href(gw - 1)} className={button}>
          {labels.prev}
        </Link>
      ) : (
        <span className={off}>{labels.prev}</span>
      )}
      {gw < lastGw ? (
        <Link href={href(gw + 1)} className={button}>
          {labels.next}
        </Link>
      ) : (
        <span className={off}>{labels.next}</span>
      )}
      {gw !== currentGw ? (
        <Link href={href(currentGw)} className={`${button} text-[var(--accent)]`}>
          {labels.current}
        </Link>
      ) : null}
    </nav>
  );
}
