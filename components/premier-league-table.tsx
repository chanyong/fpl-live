"use client";

import { useLocale } from "@/components/locale-provider";
import { RemoteImage, crestUrl } from "@/components/remote-image";
import type { PremierLeagueTableRow } from "@/lib/types";

const FORM_STYLE = {
  W: "bg-emerald-600 text-white",
  D: "bg-stone-200 text-stone-700",
  L: "bg-rose-600 text-white"
} as const;

/** Top four in Champions League blue, fifth in orange, the bottom three in red. */
function zoneBorder(position: number, total: number) {
  if (position <= 4) {
    return "border-l-[var(--chart-in)]";
  }
  if (position === 5) {
    return "border-l-orange-500";
  }
  if (position > total - 3) {
    return "border-l-[var(--chart-out)]";
  }
  return "border-l-transparent";
}

function Crest({ name, code }: { name: string; code: number }) {
  return (
    <RemoteImage
      src={crestUrl(code)}
      alt=""
      fallback={name.slice(0, 1)}
      className="h-7 w-7 shrink-0 object-contain"
      fallbackClassName="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--surface-strong)] text-[11px] font-semibold text-[var(--muted)]"
    />
  );
}

export function PremierLeagueTable({ table }: { table: PremierLeagueTableRow[] }) {
  const { tr } = useLocale();
  const numberHead = "w-[50px] px-1 py-2 text-center";
  const numberCell = "px-1 py-2.5 text-center text-[16px] tabular-nums";

  return (
    <section className="mt-3 rounded-[1.2rem] border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-[0_12px_36px_rgba(55,40,20,0.07)] md:p-2">
      <div className="mb-1.5 px-1.5">
        <div className="text-[14px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
          {tr("프리미어리그 현재 순위", "Premier League table")}
        </div>
        <div className="mt-1 text-[13px] text-[var(--muted)]">
          {tr(
            "진행 중인 경기는 현재 스코어로 반영됩니다. 동률은 골득실, 다득점 순.",
            "Matches in play count at their current score. Ties break on goal difference, then goals scored."
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px] text-[16px]">
          <thead>
            <tr className="text-[13px] font-semibold text-[var(--muted)]">
              <th className="w-[56px] px-2 py-2 text-left">{tr("순위", "Pos")}</th>
              <th className="w-[200px] px-2 py-2 text-left">{tr("팀", "Team")}</th>
              <th className={numberHead} title={tr("경기 수", "Played")}>Pl</th>
              <th className={numberHead} title={tr("승", "Won")}>W</th>
              <th className={numberHead} title={tr("무", "Drawn")}>D</th>
              <th className={numberHead} title={tr("패", "Lost")}>L</th>
              <th className={numberHead} title={tr("득점", "Goals for")}>GF</th>
              <th className={numberHead} title={tr("실점", "Goals against")}>GA</th>
              <th className={numberHead} title={tr("골득실", "Goal difference")}>GD</th>
              <th className={numberHead} title={tr("승점", "Points")}>Pts</th>
              <th className="w-[240px] px-1 py-2 text-center">{tr("최근 5경기", "Form")}</th>
              <th className="w-[120px] px-1 py-2 text-center">{tr("다음", "Next")}</th>
            </tr>
          </thead>
          <tbody>
            {table.map((row) => (
              <tr key={row.shortName} className="border-t border-[var(--border)]">
                <td className={`border-l-[3px] px-2 py-2.5 text-[16px] font-semibold tabular-nums ${zoneBorder(row.position, table.length)}`}>
                  {row.position}
                </td>
                <td className="px-2 py-2.5">
                  <span className="flex items-center gap-2.5 text-[16px] font-semibold">
                    <Crest name={row.team} code={row.teamCode} />
                    {row.team}
                  </span>
                </td>
                <td className={numberCell}>{row.played}</td>
                <td className={numberCell}>{row.won}</td>
                <td className={numberCell}>{row.drawn}</td>
                <td className={numberCell}>{row.lost}</td>
                <td className={numberCell}>{row.goalsFor}</td>
                <td className={numberCell}>{row.goalsAgainst}</td>
                <td className={numberCell}>{row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}</td>
                <td className={`${numberCell} font-bold`}>{row.points}</td>
                <td className="px-6 py-2.5">
                  <span className="flex justify-center gap-1">
                    {row.form.map((result, index) => (
                      <span
                        key={index}
                        className={`inline-flex h-[26px] w-[26px] items-center justify-center rounded-full text-[12px] font-bold ${FORM_STYLE[result]}`}
                      >
                        {result}
                      </span>
                    ))}
                  </span>
                </td>
                <td className="px-1 py-2.5">
                  {row.next ? (
                    <span
                      className="flex items-center justify-center gap-1.5 text-[13px] text-[var(--muted)]"
                      title={`${row.next.home ? tr("홈", "Home") : tr("원정", "Away")} ${row.next.opponent}`}
                    >
                      <Crest name={row.next.opponent} code={row.next.opponentCode} />
                      {row.next.home ? tr("홈", "H") : tr("원정", "A")}
                    </span>
                  ) : (
                    <span className="block text-center text-[13px] text-[var(--muted)]">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
