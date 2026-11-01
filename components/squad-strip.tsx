"use client";

import { useState } from "react";
import type { PlayerLiveCard, SquadSplit } from "@/lib/types";
import { PlayerChip } from "@/components/player-chip";
import { PointsBreakdownModal } from "@/components/points-breakdown";
import { useLocale } from "@/components/locale-provider";

export function SquadStrip({ squad, gw }: { squad: SquadSplit; gw: number }) {
  const { tr } = useLocale();
  const [selected, setSelected] = useState<PlayerLiveCard | null>(null);

  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] p-2.5 md:rounded-md md:p-3.5">
      <div className="text-caption uppercase tracking-[0.18em] text-[var(--muted)] md:text-caption">
        {tr("선발 11 · 카드를 누르면 득점 상세", "Starting 11 · tap a card for the points breakdown")}
      </div>
      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 md:mt-3 md:grid-cols-3 md:gap-3 lg:grid-cols-4">
        {squad.starters.map((player) => (
          <PlayerChip key={player.elementId} player={player} onSelect={() => setSelected(player)} />
        ))}
      </div>
      {squad.bench.length > 0 ? (
        <>
          <div className="mt-3 border-t border-dashed border-[var(--border)] pt-3 text-caption uppercase tracking-[0.18em] text-[var(--muted)] md:mt-4 md:pt-4 md:text-caption">
            {tr("벤치", "Bench")}
          </div>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 md:mt-3 md:grid-cols-4 md:gap-3">
            {squad.bench.map((player) => (
              <PlayerChip key={player.elementId} player={player} onSelect={() => setSelected(player)} />
            ))}
          </div>
        </>
      ) : null}

      {selected ? (
        <PointsBreakdownModal
          elementId={selected.elementId}
          gw={gw}
          webName={selected.webName}
          teamShortName={selected.teamShortName}
          multiplier={selected.multiplier}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </div>
  );
}
