"use client";

import type { ReactNode } from "react";
import { difficultyStyle } from "@/components/fdr-strip";
import { useLocale } from "@/components/locale-provider";
import { crestUrl, RemoteImage } from "@/components/remote-image";
import { availability } from "@/lib/player-metrics";
import { formatOpponent, metricText, type SquadMetric } from "@/lib/squad-view";
import type { EntrySquadPayload, SquadPlayer } from "@/lib/squad-types";

/** The one value a card shows under the name. Opponent and FDR can be two lines (double gameweek). */
export function MetricValue({ player, metric }: { player: SquadPlayer; metric: SquadMetric }) {
  if (metric === "opponent") {
    return player.fixtures.length === 0 ? (
      <span>-</span>
    ) : (
      <span className="flex flex-col leading-tight">
        {player.fixtures.map((fixture, index) => (
          <span key={index} className="truncate">
            {formatOpponent(fixture)}
          </span>
        ))}
      </span>
    );
  }

  if (metric === "fdr") {
    return player.fixtures.length === 0 ? (
      <span>-</span>
    ) : (
      <span className="flex flex-col items-center gap-px">
        {player.fixtures.map((fixture, index) => (
          <span
            key={index}
            style={difficultyStyle(fixture.difficulty)}
            className="inline-flex h-[18px] min-w-6 items-center justify-center rounded-[4px] px-1 text-caption font-semibold tabular-nums"
          >
            {fixture.difficulty}
          </span>
        ))}
      </span>
    );
  }

  return <span className="truncate tabular-nums">{metricText(player, metric)}</span>;
}

/** Optional extras for the recommendation view (issue #61): which players just came in, and a line under the metric. */
export type PitchExtras = { newIds?: ReadonlySet<number>; below?: (player: SquadPlayer) => ReactNode };

function Card({ player, metric, tag, extras }: { player: SquadPlayer; metric: SquadMetric; tag?: string; extras?: PitchExtras }) {
  const { tr, locale } = useLocale();
  const flag = player.status !== "a" ? availability(player.status, locale) : null;
  const note = [flag?.label, player.news].filter(Boolean).join(" · ");
  const isNew = extras?.newIds?.has(player.elementId) ?? false;

  return (
    <div className="flex min-w-0 max-w-[92px] flex-1 flex-col items-center text-center" title={note || undefined} data-new={isNew ? "true" : undefined}>
      {tag ? <span className="mb-0.5 text-caption leading-none text-[var(--muted)]">{tag}</span> : null}
      <div className={`relative ${isNew ? "rounded-sm ring-2 ring-[var(--accent)]" : ""}`}>
        <RemoteImage
          src={player.photoUrl}
          alt=""
          fallback={player.webName.slice(0, 1)}
          className="h-[52px] w-10 rounded-sm bg-white/60 object-cover object-top"
          fallbackClassName="grid h-[52px] w-10 place-items-center rounded-sm bg-white/60 text-body font-bold text-[var(--muted)]"
        />
        {player.isCaptain || player.isViceCaptain ? (
          <span
            title={player.isCaptain ? tr("주장", "Captain") : tr("부주장", "Vice-captain")}
            className="absolute -right-1.5 -top-1 grid h-5 w-5 place-items-center rounded-full bg-[var(--text)] text-caption font-bold leading-none text-white"
          >
            {player.isCaptain ? "C" : "V"}
          </span>
        ) : null}
        {isNew ? (
          <span className="absolute -bottom-1 left-0 rounded-sm bg-[var(--accent)] px-1 text-caption font-bold leading-4 text-white">IN</span>
        ) : null}
        {flag && flag.tone !== "ok" ? (
          <span
            aria-label={flag.label}
            className={`absolute -left-1 -top-1 h-3 w-3 rounded-full border border-white ${flag.tone === "warn" ? "bg-amber-400" : "bg-[var(--danger)]"}`}
          />
        ) : null}
      </div>
      <div className="mt-0.5 flex w-full items-center justify-center gap-1 rounded-t-sm bg-white px-0.5">
        <RemoteImage
          src={crestUrl(player.teamCode)}
          alt=""
          fallback=""
          className="h-3.5 w-3.5 shrink-0 object-contain"
          fallbackClassName="hidden"
        />
        <span className="truncate text-caption font-semibold leading-5">{player.webName}</span>
      </div>
      <div className="flex min-h-[22px] w-full items-center justify-center rounded-b-sm bg-[var(--accent)] px-0.5 text-caption font-semibold leading-5 text-white">
        <MetricValue player={player} metric={metric} />
      </div>
      {extras?.below ? <div className="mt-0.5 text-caption leading-tight tabular-nums text-[var(--muted)]">{extras.below(player)}</div> : null}
    </div>
  );
}

/** Pitch view: the XI by line (goalkeeper at the top), the bench in FPL's substitution order underneath. */
export function SquadPitch({ squad, metric, extras }: { squad: EntrySquadPayload["squad"]; metric: SquadMetric; extras?: PitchExtras }) {
  const { tr } = useLocale();
  const starters = squad.filter((player) => player.isStarter);
  const bench = squad.filter((player) => !player.isStarter);
  const lines = (["GKP", "DEF", "MID", "FWD"] as const).map((position) =>
    starters.filter((player) => player.position === position)
  );

  return (
    <div>
      <div className="flex flex-col gap-3 rounded-md border border-[var(--border)] bg-[var(--accent-soft)] px-2 py-3">
        {lines.map((line, index) => (
          <div key={index} className="flex items-start justify-around gap-1">
            {line.map((player) => (
              <Card key={player.elementId} player={player} metric={metric} extras={extras} />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-2 rounded-md border border-dashed border-[var(--border)] bg-[var(--surface)] px-2 py-2.5">
        <div className="mb-1.5 text-caption font-semibold text-[var(--muted)]">
          {tr("벤치 (왼쪽부터 교체 순서)", "Bench (substitution order, left to right)")}
        </div>
        <div className="flex items-start justify-around gap-1">
          {bench.map((player, index) => (
            <Card key={player.elementId} player={player} metric={metric} tag={index === 0 ? "GK" : String(index)} extras={extras} />
          ))}
        </div>
      </div>
    </div>
  );
}
