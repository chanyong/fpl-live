import type { PlayerLiveCard } from "@/lib/types";

const statusTone = {
  played: "bg-stone-200 text-stone-700",
  live: "bg-emerald-100 text-emerald-800",
  not_played: "bg-slate-100 text-slate-500"
};

const positionTone = {
  GKP: "border-l-amber-300",
  DEF: "border-l-sky-300",
  MID: "border-l-emerald-300",
  FWD: "border-l-rose-300"
};

function scoreTone(points: number, status: PlayerLiveCard["status"]) {
  if (status === "not_played") {
    return "text-stone-400";
  }

  if (points >= 8) {
    return "text-emerald-800";
  }

  if (points >= 4) {
    return "text-amber-700";
  }

  return "text-stone-700";
}

export function PlayerChip({ player }: { player: PlayerLiveCard }) {
  const pointsLabel = player.status === "not_played" ? "-" : String(player.livePoints);

  return (
    <div
      className={`flex min-w-0 flex-col rounded-[1rem] border border-[var(--border)] border-l-4 bg-white px-2.5 py-2 shadow-sm md:px-3 md:py-2.5 ${positionTone[player.position]}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold leading-4 md:text-sm">{player.webName}</div>
          <div className="mt-0.5 text-[10px] leading-4 text-[var(--muted)] md:text-xs">
            {player.teamShortName} · {player.position}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className={`text-[13px] font-semibold tabular-nums md:text-sm ${scoreTone(player.livePoints, player.status)}`}>
            {pointsLabel}
          </div>
          <div className="text-[10px] text-[var(--muted)]">pts</div>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5 text-[10px] text-[var(--muted)] md:text-xs">
          {player.isCaptain ? <span className="rounded-full bg-[var(--accent-soft)] px-1.5 py-0.5">C</span> : null}
          {player.isViceCaptain ? <span className="rounded-full bg-stone-100 px-1.5 py-0.5">VC</span> : null}
          <span>{player.minutes}'</span>
        </div>
        <span className={`rounded-full px-1.5 py-0.5 text-[10px] md:text-xs ${statusTone[player.status]}`}>
          {player.status.replace("_", " ")}
        </span>
      </div>
    </div>
  );
}
