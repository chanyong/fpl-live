import { RemoteImage } from "@/components/remote-image";
import type { PlayerLiveCard } from "@/lib/types";
import { useLocale } from "@/components/locale-provider";

const statusTone = {
  played: "bg-emerald-100 text-emerald-800",
  live: "bg-amber-100 text-amber-800",
  not_played: "bg-slate-200 text-slate-600"
};

const statusLabel = {
  played: { ko: "출전", en: "Played" },
  live: { ko: "진행", en: "Live" },
  not_played: { ko: "미출전", en: "Not played" }
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

export function PlayerChip({ player, onSelect }: { player: PlayerLiveCard; onSelect?: () => void }) {
  const { tr } = useLocale();
  const pointsLabel = player.status === "not_played" ? "-" : String(player.livePoints);

  return (
    <button
      type="button"
      onClick={onSelect}
      title={tr(`${player.webName} 득점 상세 보기`, `View ${player.webName} points breakdown`)}
      className={`flex w-full min-w-0 gap-2.5 rounded-md border border-[var(--border)] border-l-4 bg-[var(--bg)] px-2.5 py-2.5 text-left transition hover:border-[var(--accent)] md:px-3 md:py-3 ${positionTone[player.position]}`}
    >
      <RemoteImage
        src={player.photoUrl}
        alt=""
        fallback={player.webName.slice(0, 2).toUpperCase()}
        className="h-11 w-9 shrink-0 self-start rounded-md bg-[var(--surface-strong)] object-cover object-top"
        fallbackClassName="grid h-11 w-9 shrink-0 place-items-center self-start rounded-md bg-[var(--surface-strong)] text-caption font-semibold text-[var(--muted)]"
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1 truncate text-body-lg font-semibold leading-5 md:text-title">
            {player.webName}
          </div>
          {player.isCaptain ? (
            <span className="shrink-0 rounded-md bg-rose-600 px-2 py-0.5 text-caption font-bold leading-none text-white">
              C
            </span>
          ) : player.isViceCaptain ? (
            <span className="shrink-0 rounded-md bg-sky-600 px-2 py-0.5 text-caption font-bold leading-none text-white">
              VC
            </span>
          ) : null}
          <div className={`shrink-0 text-title-lg font-semibold leading-none tabular-nums md:text-score ${scoreTone(player.livePoints, player.status)}`}>
            {pointsLabel}
            <span className="ml-1 text-caption font-medium text-[var(--muted)]">{tr("점", "pts")}</span>
          </div>
        </div>

        <div className="mt-1.5 flex items-center justify-between gap-2">
          <div className="min-w-0 truncate text-caption leading-4 text-[var(--muted)]">
            {player.teamShortName} · {player.position}
            {player.minutes > 0 ? <span className="ml-1">{player.minutes}&apos;</span> : null}
          </div>
          <span className={`shrink-0 rounded-md px-2 py-0.5 text-caption font-medium ${statusTone[player.status]}`}>
            {tr(statusLabel[player.status].ko, statusLabel[player.status].en)}
          </span>
        </div>
      </div>
    </button>
  );
}
