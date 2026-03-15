import type { SquadSplit } from "@/lib/types";
import { PlayerChip } from "@/components/player-chip";

export function SquadStrip({ squad }: { squad: SquadSplit }) {
  return (
    <div className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface)] p-3 md:p-4">
      <div className="text-[11px] uppercase tracking-[0.2em] text-[var(--muted)]">
        Starting XI
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {squad.starters.map((player) => (
          <PlayerChip key={player.elementId} player={player} />
        ))}
      </div>
      {squad.bench.length > 0 ? (
        <>
          <div className="mt-4 border-t border-dashed border-[var(--border)] pt-4 text-[11px] uppercase tracking-[0.2em] text-[var(--muted)]">
            Bench
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {squad.bench.map((player) => (
              <PlayerChip key={player.elementId} player={player} />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
