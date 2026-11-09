"use client";

import { useState } from "react";
import { useLocale } from "@/components/locale-provider";
import { groupFixturesByDay, playerDisplayPoints, type SnapshotPlayer, type WeeklySnapshot } from "@/lib/journal-snapshot";
import { pointsLabel, pointsValueLabel } from "@/lib/player-metrics";

const ROWS: Array<{ type: number; ko: string; en: string }> = [
  { type: 4, ko: "공격수", en: "Forwards" },
  { type: 3, ko: "미드필더", en: "Midfielders" },
  { type: 2, ko: "수비수", en: "Defenders" },
  { type: 1, ko: "골키퍼", en: "Goalkeeper" }
];

const CHIP_LABELS: Record<string, [string, string]> = {
  "3xc": ["트리플 캡틴", "Triple Captain"],
  bboost: ["벤치 부스트", "Bench Boost"],
  freehit: ["프리 히트", "Free Hit"],
  wildcard: ["와일드카드", "Wildcard"],
  manager: ["어시스턴트 매니저", "Assistant Manager"]
};

/**
 * One saved gameweek as FPL's Pitch view: 11 starters by line, the bench in substitution order,
 * the points ledger behind each player, and the gameweek's results. Reads only what the snapshot froze,
 * and shows nothing for snapshots saved before the detail existed (issue #27).
 */
export function JournalPitch({ snapshot }: { snapshot: WeeklySnapshot }) {
  const { tr } = useLocale();
  const [openId, setOpenId] = useState<number | null>(null);
  const players = snapshot.players;
  if (!players || players.length === 0) {
    return (
      <p className="mt-3 text-meta text-[var(--muted)]">
        {tr("이 주는 선수별 상세가 아직 저장되지 않았습니다.", "Player details have not been saved for this week yet.")}
      </p>
    );
  }

  const starters = players.filter((player) => player.slot <= 11);
  const bench = players.filter((player) => player.slot > 11).sort((a, b) => a.slot - b.slot);
  const subsIn = new Set((snapshot.autoSubs ?? []).map((sub) => sub.in));
  const subsOut = new Set((snapshot.autoSubs ?? []).map((sub) => sub.out));
  const chip = snapshot.chip ? CHIP_LABELS[snapshot.chip] : null;
  const open = players.find((player) => player.id === openId) ?? null;

  const card = (player: SnapshotPlayer, benchOrder?: number) => (
    <li key={player.id} className="min-w-0 flex-1 basis-0">
      <button
        type="button"
        aria-pressed={openId === player.id}
        aria-label={`${player.name} ${playerDisplayPoints(player)}${tr("점", " pts")}`}
        onClick={() => setOpenId(openId === player.id ? null : player.id)}
        className={`relative mx-auto flex w-full max-w-[84px] flex-col items-center rounded-md px-0.5 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] ${
          openId === player.id ? "bg-[var(--accent-soft)]" : ""
        }`}
      >
        <span className="relative flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-caption font-semibold">
          {player.team}
          {player.isCaptain && <Badge label="C" tone="accent" />}
          {!player.isCaptain && player.isVice && <Badge label="V" tone="muted" />}
        </span>
        <span className="mt-1 w-full truncate text-center text-meta font-semibold">{player.name}</span>
        <span className="tabular-nums text-meta text-[var(--muted)]">
          <strong className="text-[var(--text)]">{playerDisplayPoints(player)}</strong>
          {player.slot <= 11 && player.multiplier > 1 ? ` (x${player.multiplier})` : ""}
        </span>
        {benchOrder !== undefined && <span className="text-caption text-[var(--muted)]">{benchOrder}</span>}
        {subsIn.has(player.id) && <span className="text-caption font-semibold text-[var(--accent)]">{tr("교체 투입", "Sub in")}</span>}
        {subsOut.has(player.id) && <span className="text-caption text-[var(--danger)]">{tr("교체 아웃", "Sub out")}</span>}
      </button>
    </li>
  );

  return (
    <div className="mt-3">
      <dl className="grid grid-cols-3 gap-2 text-center text-meta sm:grid-cols-6">
        <Stat label={tr("GW 점수", "GW pts")} value={snapshot.points} />
        <Stat label={tr("평균", "Average")} value={snapshot.average} />
        <Stat label={tr("최고", "Highest")} value={snapshot.highest} />
        <Stat label={tr("GW 순위", "GW rank")} value={snapshot.gwRank?.toLocaleString() ?? null} />
        <Stat label={tr("이적", "Transfers")} value={snapshot.transfers} />
        <Stat label={tr("이적 감점", "Hit")} value={snapshot.transferCost > 0 ? `-${snapshot.transferCost}` : 0} />
      </dl>
      {chip && (
        <p className="mt-2 text-meta font-semibold text-[var(--accent)]">
          {tr("칩 사용", "Chip played")}: {tr(chip[0], chip[1])}
        </p>
      )}

      <div className="mt-3 space-y-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] p-2">
        {ROWS.map((row) => {
          const line = starters.filter((player) => player.type === row.type).sort((a, b) => a.slot - b.slot);
          return line.length === 0 ? null : (
            <ul key={row.type} aria-label={tr(row.ko, row.en)} className="flex gap-1">
              {line.map((player) => card(player))}
            </ul>
          );
        })}
        <div className="border-t border-dashed border-[var(--border)] pt-2">
          <p className="mb-1 text-caption text-[var(--muted)]">{tr("후보 (교체 순서)", "Bench (substitution order)")}</p>
          <ul className="flex gap-1">{bench.map((player, index) => card(player, index + 1))}</ul>
        </div>
      </div>

      {open && <PlayerLedger player={open} snapshot={snapshot} />}
      <Results snapshot={snapshot} players={players} />
    </div>
  );
}

function Badge({ label, tone }: { label: string; tone: "accent" | "muted" }) {
  return (
    <span
      aria-hidden="true"
      className={`absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full text-caption font-bold text-white ${
        tone === "accent" ? "bg-[var(--accent)]" : "bg-[var(--muted)]"
      }`}
    >
      {label}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="rounded-md border border-[var(--border)] px-1 py-1">
      <dt className="text-caption text-[var(--muted)]">{label}</dt>
      <dd className="tabular-nums font-semibold">{value ?? "-"}</dd>
    </div>
  );
}

function PlayerLedger({ player, snapshot }: { player: SnapshotPlayer; snapshot: WeeklySnapshot }) {
  const { tr, locale } = useLocale();
  const clubs = snapshot.teams ?? {};
  const byFixture = new Map(snapshot.fixtures.map((fixture) => [fixture.id, fixture]));
  const total = player.fixtures.reduce((sum, fixture) => sum + fixture.stats.reduce((inner, stat) => inner + stat.points, 0), 0);
  return (
    <section aria-label={player.name} className="mt-3 rounded-lg border border-[var(--border)] p-2">
      <h3 className="text-body font-semibold">
        {player.name} <span className="font-normal text-[var(--muted)]">{player.team}</span>
      </h3>
      {player.fixtures.length === 0 ? (
        <p className="mt-1 text-meta text-[var(--muted)]">{tr("이 주 출전 기록이 없습니다.", "No appearances this week.")}</p>
      ) : (
        player.fixtures.map((entry) => {
          const fixture = byFixture.get(entry.fixture);
          const label = fixture ? `${clubs[String(fixture.teamH)] ?? "-"} v ${clubs[String(fixture.teamA)] ?? "-"}` : `#${entry.fixture}`;
          return (
            <div key={entry.fixture} className="mt-2">
              <p className="text-caption font-semibold text-[var(--muted)]">{label}</p>
              <table className="w-full border-collapse text-meta">
                <tbody>
                  {entry.stats.map((stat) => (
                    <tr key={stat.id} className="border-b border-dashed border-[var(--border)]">
                      <td className="py-1">{pointsLabel(stat.id, locale)}</td>
                      <td className="py-1 text-right tabular-nums text-[var(--muted)]">{pointsValueLabel(stat.id, stat.value, locale)}</td>
                      <td className="w-12 py-1 text-right tabular-nums font-semibold">{stat.points > 0 ? `+${stat.points}` : stat.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })
      )}
      <p className="mt-2 text-right text-meta font-semibold">
        {tr("합계", "Total")} <span className="tabular-nums">{total}</span>
        {player.slot <= 11 && player.multiplier > 1 ? ` x${player.multiplier} = ${total * player.multiplier}` : ""}
      </p>
    </section>
  );
}

function formatDay(format: Intl.DateTimeFormat, day: string) {
  const date = new Date(`${day}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? "-" : format.format(date);
}

function Results({ snapshot, players }: { snapshot: WeeklySnapshot; players: SnapshotPlayer[] }) {
  const { tr, locale } = useLocale();
  const clubs = snapshot.teams;
  if (!clubs || snapshot.fixtures.length === 0) return null;
  // A fixture counts as "mine" when one of my squad actually played minutes in it.
  const mine = new Map<number, string[]>();
  for (const player of players) {
    for (const entry of player.fixtures) {
      const minutes = entry.stats.find((stat) => stat.id === "minutes")?.value ?? 0;
      if (minutes > 0) mine.set(entry.fixture, [...(mine.get(entry.fixture) ?? []), player.name]);
    }
  }
  const dayFormat = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "ko-KR", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

  return (
    <section className="mt-4" aria-label={tr("경기 결과", "Results")}>
      <h3 className="text-body font-semibold">{tr(`GW${snapshot.gw} 경기 결과`, `GW${snapshot.gw} results`)}</h3>
      {groupFixturesByDay(snapshot.fixtures).map(({ day, items }) => (
        <div key={day || "unknown"} className="mt-2">
          {day && <p className="text-caption font-semibold text-[var(--muted)]">{formatDay(dayFormat, day)}</p>}
          <ul className="divide-y divide-[var(--border)] rounded-md border border-[var(--border)]">
            {items.map((fixture) => (
              <li key={fixture.id} className="px-2 py-1.5 text-meta">
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                  <span className="truncate text-right font-semibold">{clubs[String(fixture.teamH)] ?? "-"}</span>
                  <span className="tabular-nums rounded bg-[var(--accent-soft)] px-2 py-0.5 text-center font-bold">
                    {fixture.scoreH !== null && fixture.scoreA !== null ? `${fixture.scoreH} - ${fixture.scoreA}` : "v"}
                  </span>
                  <span className="truncate font-semibold">{clubs[String(fixture.teamA)] ?? "-"}</span>
                </div>
                {fixture.finished && <p className="text-center text-caption text-[var(--muted)]">FT</p>}
                {mine.has(fixture.id) && (
                  <p className="mt-0.5 text-center text-caption text-[var(--accent)]">
                    {tr("내 선수", "My players")}: {mine.get(fixture.id)!.join(", ")}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
