import type { SquadSplit } from "@/lib/types";
import { PlayerChip } from "@/components/player-chip";

export function SquadStrip({ squad }: { squad: SquadSplit }) {
  return (
    <div className="rounded-[1.1rem] border border-[var(--border)] bg-[var(--surface)] p-2.5 md:rounded-[1.35rem] md:p-3.5">
      <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--muted)] md:text-[11px]">
        Starting XI
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 md:mt-3 md:grid-cols-3 md:gap-3 lg:grid-cols-5">
        {squad.starters.map((player) => (
          <PlayerChip key={player.elementId} player={player} />
        ))}
      </div>
      {squad.bench.length > 0 ? (
        <>
          <div className="mt-3 border-t border-dashed border-[var(--border)] pt-3 text-[10px] uppercase tracking-[0.18em] text-[var(--muted)] md:mt-4 md:pt-4 md:text-[11px]">
            Bench
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 md:mt-3 md:grid-cols-4 md:gap-3">
            {squad.bench.map((player) => (
              <PlayerChip key={player.elementId} player={player} />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}