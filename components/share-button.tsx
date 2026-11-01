"use client";

import { useState } from "react";
import { useLocale } from "@/components/locale-provider";

export function ShareButton({ leagueName }: { leagueName?: string }) {
  const { tr } = useLocale();
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = new URL(window.location.href);
    url.search = "";
    url.searchParams.set("ref", "share");
    const text = tr(
      `${leagueName ?? "우리 미니리그"} 라이브 순위를 FPL Live에서 확인하세요`,
      `Follow ${leagueName ?? "our mini-league"} live on FPL Live`
    );

    try {
      if (navigator.share) {
        await navigator.share({ title: "FPL Live", text, url: url.toString() });
        return;
      }
      await navigator.clipboard.writeText(`${text} ${url.toString()}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // The user dismissed the share sheet or clipboard access was denied; nothing to recover.
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      className="inline-flex shrink-0 items-center rounded-md border border-[var(--accent)] bg-[var(--accent-soft)] px-3.5 py-1.5 text-caption font-semibold text-[var(--accent-ink)] transition hover:bg-[var(--bg)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
    >
      {copied ? tr("링크 복사됨", "Link copied") : tr("리그 공유", "Share league")}
    </button>
  );
}
