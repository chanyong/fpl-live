import Image from "next/image";
import type { PlayerLiveCard } from "@/lib/types";

const statusTone = {
  played: "bg-stone-200 text-stone-700",
  live: "bg-emerald-100 text-emerald-800",
  not_played: "bg-slate-100 text-slate-600"
};

export function PlayerChip({ player }: { player: PlayerLiveCard }) {
  return (
    <div className="flex min-w-0 flex-col rounded-2xl border border-[var(--border)] bg-white p-3 shadow-sm">
      <div className="flex items-center gap-3">
        {player.photoUrl ? (
          <Image
            src={player.photoUrl}
            alt={player.webName}
            width={40}
            height={50}
            className="h-[50px] w-10 rounded-xl bg-[var(--surface-strong)] object-cover"
          />
        ) : (
          <div className="flex h-[50px] w-10 items-center justify-center rounded-xl bg-[var(--surface-strong)] text-xs">
            {player.position}
          </div>
        )}
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold md:text-base">{player.webName}</div>
          <div className="text-xs text-[var(--muted)] md:text-sm">
            {player.teamShortName} · {player.position}
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 text-sm">
        <span className="font-semibold tabular-nums">{player.livePoints} pts</span>
        <span className={`rounded-full px-2 py-1 text-[10px] md:text-xs ${statusTone[player.status]}`}>
          {player.status.replace("_", " ")}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-[var(--muted)] md:text-xs">
        {player.isCaptain ? <span className="rounded-full bg-[var(--accent-soft)] px-2 py-1">C</span> : null}
        {player.isViceCaptain ? <span className="rounded-full bg-stone-100 px-2 py-1">VC</span> : null}
        <span>{player.minutes}'</span>
      </div>
    </div>
  );
}
