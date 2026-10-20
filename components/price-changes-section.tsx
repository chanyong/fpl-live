"use client";

import { useState } from "react";
import { SubTabs } from "@/components/sub-tabs";
import { priceOutlook, selectPricePredictions, selectRecentPriceChanges, type PriceOutlook } from "@/lib/price-changes";
import { formatMoney } from "@/lib/season-summary";
import type { PlayerStat } from "@/lib/types";
import { useLocale } from "@/components/locale-provider";

type PriceView = "predictions" | "recent";

const PAGE_SIZE = 20;

const OUTLOOK_STYLE: Record<PriceOutlook, string> = {
  "very-likely": "bg-[var(--text)] text-white",
  likely: "bg-amber-100 text-amber-900",
  unlikely: "bg-[var(--border)] text-[var(--muted)]"
};

function signed(value: number) {
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

export function PriceChangesSection({ players, onSelect }: { players: PlayerStat[]; onSelect: (id: number) => void }) {
  const { tr } = useLocale();
  const [view, setView] = useState<PriceView>("predictions");
  const [shown, setShown] = useState(PAGE_SIZE);

  const rows = view === "predictions" ? selectPricePredictions(players) : selectRecentPriceChanges(players);
  const outlookLabel: Record<PriceOutlook, string> = {
    "very-likely": tr("매우 유력", "Very likely"),
    likely: tr("유력", "Likely"),
    unlikely: tr("가능성 낮음", "Unlikely")
  };

  return (
    <section className="rounded-[1.2rem] border border-[var(--border)] bg-[var(--surface)] p-3 shadow-[0_12px_36px_rgba(55,40,20,0.07)]">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-[1rem] font-semibold">{tr("가격 변동", "Price changes")}</h3>
          <p className="text-[12px] leading-relaxed text-[var(--muted)]">
            {view === "predictions"
              ? tr(
                  "FPL이 제공하는 진행률과 다음 갱신 예상치입니다. 100%에 닿으면 상승, −100%에 닿으면 하락합니다.",
                  "FPL's progress meter and its projection for the next update. +100% means a rise, −100% a fall."
                )
              : tr(
                  "직전 데드라인 이후 이미 가격이 움직인 선수입니다. FPL 공개 데이터에는 변동 날짜가 없습니다.",
                  "Players whose price has moved since the last deadline. FPL's public data carries no change dates."
                )}
          </p>
        </div>
        <SubTabs<PriceView>
          label={tr("가격 변동 보기", "Price change views")}
          items={[
            { id: "predictions", label: tr("예측", "Predictions") },
            { id: "recent", label: tr("최근 변동", "Recent changes") }
          ]}
          value={view}
          onChange={(next) => {
            setView(next);
            setShown(PAGE_SIZE);
          }}
        />
      </div>

      {rows.length === 0 ? (
        <p className="py-4 text-center text-sm text-[var(--muted)]">
          {tr("이번 게임위크에는 아직 가격이 움직인 선수가 없습니다.", "No price has moved yet this gameweek.")}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[460px] text-left text-[13px]">
            <thead className="text-[11px] uppercase tracking-wide text-[var(--muted)]">
              <tr>
                <th className="py-1.5 pr-2 font-semibold">{tr("선수", "Player")}</th>
                {view === "predictions" ? (
                  <>
                    <th className="px-2 py-1.5 font-semibold">{tr("진행률", "Progress")}</th>
                    <th className="px-2 py-1.5 font-semibold">{tr("예상", "Projected")}</th>
                    <th className="px-2 py-1.5 font-semibold">{tr("전망", "Outlook")}</th>
                    <th className="py-1.5 pl-2 text-right font-semibold">{tr("현재가", "Price")}</th>
                  </>
                ) : (
                  <>
                    <th className="px-2 py-1.5 font-semibold">{tr("변동", "Change")}</th>
                    <th className="py-1.5 pl-2 text-right font-semibold">{tr("이전 → 현재", "Was → Now")}</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, shown).map((player) => (
                <tr key={player.id} className="border-t border-[var(--border)]">
                  <td className="py-1.5 pr-2">
                    <button
                      type="button"
                      onClick={() => onSelect(player.id)}
                      className="text-left font-semibold underline-offset-4 hover:text-[var(--accent)] hover:underline"
                    >
                      {player.webName}
                    </button>
                    <span className="ml-1.5 text-[11px] text-[var(--muted)]">
                      {player.teamShortName} · {player.position}
                    </span>
                  </td>
                  {view === "predictions" ? (
                    <>
                      <td className="px-2 py-1.5 tabular-nums">{signed(player.priceChangePercent)}</td>
                      <td className="px-2 py-1.5 tabular-nums">{signed(player.projectedPercent)}</td>
                      <td className="px-2 py-1.5">
                        {player.priceLockedUntil && new Date(player.priceLockedUntil).getTime() > Date.now() ? (
                          <span className="text-[11px] text-[var(--muted)]">{tr("변동 잠금", "Locked")}</span>
                        ) : (
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${OUTLOOK_STYLE[priceOutlook(player.projectedPercent)]}`}
                          >
                            {outlookLabel[priceOutlook(player.projectedPercent)]}{" "}
                            {player.projectedPercent >= 0 ? "▲" : "▼"}
                          </span>
                        )}
                      </td>
                      <td className="py-1.5 pl-2 text-right tabular-nums">{formatMoney(player.cost)}</td>
                    </>
                  ) : (
                    <>
                      <td
                        className={`px-2 py-1.5 font-semibold tabular-nums ${
                          player.costChangeEvent > 0 ? "text-emerald-700" : "text-[var(--danger)]"
                        }`}
                      >
                        {player.costChangeEvent > 0 ? "+" : "−"}£{(Math.abs(player.costChangeEvent) / 10).toFixed(1)}m
                      </td>
                      <td className="py-1.5 pl-2 text-right tabular-nums">
                        {formatMoney(player.cost - player.costChangeEvent)} → {formatMoney(player.cost)}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rows.length > shown ? (
        <button
          type="button"
          onClick={() => setShown((count) => count + PAGE_SIZE)}
          className="mt-2 w-full rounded-full border border-[var(--border)] bg-white py-2 text-[13px] font-semibold text-[var(--muted)] transition hover:border-[var(--accent)]"
        >
          {tr(`더 보기 (${rows.length - shown})`, `Show more (${rows.length - shown})`)}
        </button>
      ) : null}
    </section>
  );
}
