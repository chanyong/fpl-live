import Image from "next/image";
import type { CaptainStat } from "@/lib/types";

export function CaptainStats({ stats }: { stats: CaptainStat[] }) {
  if (stats.length === 0) {
    return null;
  }

  return (
    <section className="mb-4 hidden rounded-[2rem] border border-[var(--border)] bg-[var(--surface)] px-4 py-6 shadow-[0_18px_48px_rgba(55,40,20,0.08)] md:block md:px-8 md:py-8">
      <h2 className="text-center text-2xl font-semibold md:text-4xl">Top 3 Captain Picks</h2>
      <div className="mt-6 grid grid-cols-3 gap-3 md:mt-8 md:gap-8">
        {stats.map((captain) => (
          <div key={captain.elementId} className="flex flex-col items-center text-center">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-[var(--surface-strong)] md:h-28 md:w-28">
              {captain.photoUrl ? (
                <Image
                  src={captain.photoUrl}
                  alt={captain.webName}
                  width={112}
                  height={112}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="text-xs text-[var(--muted)]">No photo</div>
              )}
            </div>
            <div className="mt-3 text-sm font-semibold leading-5 md:text-2xl">{captain.webName}</div>
            <div className="mt-1 text-lg text-[var(--muted)] md:text-[2rem]">{captain.percentage}%</div>
          </div>
        ))}
      </div>
    </section>
  );
}
