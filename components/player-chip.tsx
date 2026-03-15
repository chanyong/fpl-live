import type { PlayerLiveCard } from "@/lib/types";

const statusTone = {
  played: "bg-emerald-100 text-emerald-800",
  live: "bg-amber-100 text-amber-800",
  not_played: "bg-slate-200 text-slate-600"
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
      className={`flex min-w-0 flex-col rounded-[1rem] border border-[var(--border)] border-l-4 bg-white px-3 py-2.5 shadow-sm md:px-3.5 md:py-3 ${positionTone[player.position]}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 truncate text-[16px] font-semibold leading-5 md:text-[18px]">
          {player.webName}
        </div>
        <div className={`shrink-0 text-[18px] font-semibold leading-none tabular-nums md:text-[22px] ${scoreTone(player.livePoints, player.status)}`}>
          {pointsLabel}
          <span className="ml-1 text-[12px] font-medium text-[var(--muted)] md:text-[13px]">pts</span>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="min-w-0 truncate text-[12px] leading-4 text-[var(--muted)] md:text-[13px]">
          {player.teamShortName} · {player.position}
          {player.isCaptain ? (
            <span className="ml-1.5 rounded-full border border-rose-300 bg-rose-50 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-rose-700 md:text-[11px]">
              C
            </span>
          ) : null}
          {player.isViceCaptain ? (
            <span className="ml-1.5 rounded-full border border-rose-300 bg-rose-50 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-rose-700 md:text-[11px]">
              VC
            </span>
          ) : null}
          <span className="ml-1.5">{player.minutes}'</span>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium md:text-xs ${statusTone[player.status]}`}>
          {player.status.replace("_", " ")}
        </span>
      </div>
    </div>
  );
}