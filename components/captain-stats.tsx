import { RemoteImage } from "@/components/remote-image";
import type { CaptainStat } from "@/lib/types";
import { useLocale } from "@/components/locale-provider";

export function CaptainStats({ stats, layout = "row" }: { stats: CaptainStat[]; layout?: "row" | "list" }) {
  const { tr } = useLocale();
  if (stats.length === 0) {
    return null;
  }

  return (
    <section className="rounded-[1.2rem] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2 shadow-[0_14px_30px_rgba(55,40,20,0.06)] md:px-4 md:py-2.5">
      <div className={`flex flex-col gap-1.5 ${layout === "row" ? "md:flex-row md:items-center md:justify-between md:gap-4" : ""}`}>
        <h2 className="shrink-0 text-meta font-semibold uppercase tracking-[0.14em] text-[var(--muted)] md:text-lg md:normal-case md:tracking-normal md:text-[var(--text)]">
          {tr("주장 선택 Top 3", "Top 3 captains")}
        </h2>
        <div className={`grid flex-1 gap-2 ${layout === "row" ? "grid-cols-3 md:gap-4" : "grid-cols-3 lg:grid-cols-1"}`}>
          {stats.map((captain) => (
            <div
              key={captain.elementId}
              className="flex min-w-0 items-center gap-2 rounded-2xl bg-white/80 px-2 py-1.5 md:gap-3 md:px-3 md:py-2"
            >
              <RemoteImage
                src={captain.photoUrl}
                alt=""
                fallback={captain.webName.slice(0, 2).toUpperCase()}
                className="h-10 w-8 shrink-0 rounded-[0.5rem] bg-[var(--surface-strong)] object-cover object-top md:h-11 md:w-9"
                fallbackClassName="grid h-10 w-8 shrink-0 place-items-center rounded-[0.5rem] bg-[var(--surface-strong)] text-caption font-semibold text-[var(--muted)] md:h-11 md:w-9"
              />
              <div className="min-w-0">
                <div className="truncate text-meta font-semibold md:text-body">{captain.webName}</div>
                <div className="text-caption text-[var(--muted)] md:text-caption">
                  {captain.percentage}%
                  <span className="ml-1 hidden md:inline">· {captain.managerCount}{tr("명", "")}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
