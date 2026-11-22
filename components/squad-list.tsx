"use client";

import { difficultyStyle } from "@/components/fdr-strip";
import { useLocale } from "@/components/locale-provider";
import { crestUrl, RemoteImage } from "@/components/remote-image";
import { availability, POSITION_LABELS } from "@/lib/player-metrics";
import { formatMoney } from "@/lib/season-summary";
import { formatOpponent, formatPriceChange } from "@/lib/squad-view";
import type { EntrySquadPayload } from "@/lib/squad-types";

/** List view: every value for every player at once, starters first, then the bench in substitution order. */
export function SquadList({ squad }: { squad: EntrySquadPayload["squad"] }) {
  const { tr, locale } = useLocale();

  const header = (ko: string, en: string, right = true) => (
    <th scope="col" className={`whitespace-nowrap px-2 py-1.5 text-caption font-semibold ${right ? "text-right" : "text-left"}`}>
      {tr(ko, en)}
    </th>
  );

  return (
    <div className="overflow-x-auto rounded-md border border-[var(--border)] bg-[var(--surface)]">
      <table className="w-full min-w-[640px] text-meta">
        <thead>
          <tr className="border-b border-[var(--border)] bg-[var(--surface-strong)]/50 text-[var(--muted)]">
            {header("선수", "Player", false)}
            {header("상대", "Opponent", false)}
            {header("점수", "Pts")}
            {header("현재가", "Price")}
            {header("판매가(추정)", "Sell (est.)")}
            {header("FDR", "FDR")}
            {header("폼", "Form")}
            {header("소유율", "Own.")}
            {header("가격 변동", "Change")}
          </tr>
        </thead>
        <tbody>
          {squad.map((player) => {
            const flag = player.status !== "a" ? availability(player.status, locale) : null;
            return (
              <tr
                key={player.elementId}
                className={`border-b border-[var(--border)] last:border-b-0 ${player.isStarter ? "" : "bg-[var(--surface-strong)]/30"}`}
              >
                <td className="px-2 py-1.5">
                  <div className="flex items-center gap-1.5">
                    <RemoteImage
                      src={crestUrl(player.teamCode)}
                      alt=""
                      fallback=""
                      className="h-4 w-4 shrink-0 object-contain"
                      fallbackClassName="hidden"
                    />
                    <span className="font-semibold">{player.webName}</span>
                    <span className="text-caption text-[var(--muted)]">{POSITION_LABELS[player.position]}</span>
                    {player.isCaptain || player.isViceCaptain ? (
                      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--text)] text-caption font-bold leading-none text-white">
                        {player.isCaptain ? "C" : "V"}
                      </span>
                    ) : null}
                    {!player.isStarter ? (
                      <span className="whitespace-nowrap text-caption text-[var(--muted)]">
                        {player.pickPosition === 12 ? tr("벤치 GK", "Bench GK") : tr(`벤치 ${player.pickPosition - 12}`, `Bench ${player.pickPosition - 12}`)}
                      </span>
                    ) : null}
                    {flag && flag.tone !== "ok" ? (
                      <span
                        title={player.news || flag.label}
                        className={`text-caption font-semibold ${flag.tone === "warn" ? "text-[var(--warning)]" : "text-[var(--danger)]"}`}
                      >
                        {flag.label}
                      </span>
                    ) : null}
                  </div>
                </td>
                <td className="whitespace-nowrap px-2 py-1.5">
                  {player.fixtures.length === 0 ? "-" : player.fixtures.map(formatOpponent).join(", ")}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">{player.eventPoints ?? "-"}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{formatMoney(player.nowCost)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{formatMoney(player.sellingPrice)}</td>
                <td className="px-2 py-1.5 text-right">
                  {player.fixtures.length === 0 ? (
                    "-"
                  ) : (
                    <span className="inline-flex gap-0.5">
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
                  )}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">{player.form.toFixed(1)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{player.selectedByPercent.toFixed(1)}%</td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums">
                  {formatPriceChange(player.costChangeStart)}
                  <span className="ml-1 text-caption text-[var(--muted)]">
                    ({tr("이번 GW ", "GW ")}
                    {formatPriceChange(player.costChangeEvent)})
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
