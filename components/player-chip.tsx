import { RemoteImage } from "@/components/remote-image";
import type { PlayerLiveCard } from "@/lib/types";

const statusTone = {
  played: "bg-emerald-100 text-emerald-800",
  live: "bg-amber-100 text-amber-800",
  not_played: "bg-slate-200 text-slate-600"
};

const statusLabel = {
  played: "출전",
  live: "진행",
  not_played: "미출전"
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
      className={`flex min-w-0 gap-2.5 rounded-[1rem] border border-[var(--border)] border-l-4 bg-white px-2.5 py-2.5 shadow-sm md:px-3 md:py-3 ${positionTone[player.position]}`}
    >
      <RemoteImage
        src={player.photoUrl}
        alt=""
        fallback={player.webName.slice(0, 2).toUpperCase()}
        className="h-11 w-9 shrink-0 self-start rounded-[0.55rem] bg-[var(--surface-strong)] object-cover object-top"
        fallbackClassName="grid h-11 w-9 shrink-0 place-items-center self-start rounded-[0.55rem] bg-[var(--surface-strong)] text-[11px] font-semibold text-[var(--muted)]"
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1 truncate text-[15px] font-semibold leading-5 md:text-[17px]">
            {player.webName}
          </div>
          {player.isCaptain ? (
            <span className="shrink-0 rounded-full bg-rose-600 px-2 py-0.5 text-[12px] font-bold leading-none text-white">
              C
            </span>
          ) : player.isViceCaptain ? (
            <span className="shrink-0 rounded-full bg-sky-600 px-2 py-0.5 text-[12px] font-bold leading-none text-white">
              VC
            </span>
          ) : null}
          <div className={`shrink-0 text-[18px] font-semibold leading-none tabular-nums md:text-[21px] ${scoreTone(player.livePoints, player.status)}`}>
            {pointsLabel}
            <span className="ml-1 text-[12px] font-medium text-[var(--muted)]">점</span>
          </div>
        </div>

        <div className="mt-1.5 flex items-center justify-between gap-2">
          <div className="min-w-0 truncate text-[12px] leading-4 text-[var(--muted)]">
            {player.teamShortName} · {player.position}
            {player.minutes > 0 ? <span className="ml-1">{player.minutes}&apos;</span> : null}
          </div>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${statusTone[player.status]}`}>
            {statusLabel[player.status]}
          </span>
        </div>
      </div>
    </div>
  );
}
