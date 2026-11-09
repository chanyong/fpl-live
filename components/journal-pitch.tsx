"use client";

import { useState, type ReactNode } from "react";
import { useLocale } from "@/components/locale-provider";
import { groupFixturesByDay, playerDisplayPoints, type SnapshotPlayer, type WeeklySnapshot } from "@/lib/journal-snapshot";
import { pointsLabel, pointsValueLabel } from "@/lib/player-metrics";

const POSITIONS: Record<number, { code: string; stripe: string }> = {
  1: { code: "GKP", stripe: "border-l-amber-300" },
  2: { code: "DEF", stripe: "border-l-sky-300" },
  3: { code: "MID", stripe: "border-l-emerald-300" },
  4: { code: "FWD", stripe: "border-l-rose-300" }
};

const CHIP_LABELS: Record<string, [string, string]> = {
  "3xc": ["트리플 캡틴", "Triple Captain"],
  bboost: ["벤치 부스트", "Bench Boost"],
  freehit: ["프리 히트", "Free Hit"],
  wildcard: ["와일드카드", "Wildcard"],
  manager: ["어시스턴트 매니저", "Assistant Manager"]
};

/** Numbered step heading shared by the journal's four steps (result, players, matches, write). */
export function StepHeading({ step, title, hint }: { step: number; title: string; hint?: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span aria-hidden="true" className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--accent)] text-caption font-bold text-white">
        {step}
      </span>
      <div className="min-w-0">
        <h3 className="text-title font-semibold leading-6">{title}</h3>
        {hint && <p className="text-meta text-[var(--muted)]">{hint}</p>}
      </div>
    </div>
  );
}

/**
 * One saved gameweek as steps 1-3 of the journal: result summary, player cards, match cards.
 * Reads only what the snapshot froze (issue #27); `previous` is the saved week before it, used only to show change.
 * Snapshots saved before the detail existed show the summary and a safe note instead of players (issue #31).
 */
export function JournalPitch({ snapshot, previous }: { snapshot: WeeklySnapshot; previous?: WeeklySnapshot | null }) {
  const { tr } = useLocale();
  const [openId, setOpenId] = useState<number | null>(null);
  const players = snapshot.players;
  const hasPlayers = Boolean(players && players.length > 0);

  const starters = hasPlayers ? players!.filter((player) => player.slot <= 11) : [];
  const bench = hasPlayers ? players!.filter((player) => player.slot > 11).sort((a, b) => a.slot - b.slot) : [];
  const subsIn = new Set((snapshot.autoSubs ?? []).map((sub) => sub.in));
  const subsOut = new Set((snapshot.autoSubs ?? []).map((sub) => sub.out));
  const open = hasPlayers ? (players!.find((player) => player.id === openId) ?? null) : null;

  const card = (player: SnapshotPlayer, benchOrder?: number) => {
    const position = POSITIONS[player.type] ?? POSITIONS[3];
    const isStarter = player.slot <= 11;
    const status = playerStatus(player, subsIn.has(player.id), subsOut.has(player.id));
    const points = playerDisplayPoints(player);
    const selected = openId === player.id;
    return (
      <li key={player.id} className="min-w-0">
        <button
          type="button"
          aria-pressed={selected}
          aria-label={`${player.name} ${points}${tr("점", " pts")}`}
          onClick={() => setOpenId(selected ? null : player.id)}
          className={`flex h-full w-full min-w-0 gap-2 rounded-md border border-l-4 p-2.5 text-left transition hover:border-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] ${position.stripe} ${
            selected ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--border)] bg-[var(--bg)]"
          } ${!isStarter ? "opacity-90" : ""}`}
        >
          <span
            aria-hidden="true"
            className="hidden h-9 w-9 shrink-0 place-items-center self-start rounded-full bg-[var(--surface-strong)] text-caption font-semibold text-[var(--muted)] sm:grid"
          >
            {player.team.slice(0, 3)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-start justify-between gap-1.5">
              <span className="min-w-0 flex-1 truncate text-body-lg font-semibold leading-5">{player.name}</span>
              <span className="shrink-0 tabular-nums leading-none">
                <strong className="text-title-lg font-semibold">{points}</strong>
                <span className="ml-0.5 text-caption font-medium text-[var(--muted)]">{tr("점", "pts")}</span>
              </span>
            </span>
            <span className="mt-1 block truncate text-caption leading-4 text-[var(--muted)]">
              {player.team} · {position.code}
              {player.minutes > 0 ? ` · ${player.minutes}'` : ""}
              {isStarter && player.multiplier > 1 && <span className="ml-1 tabular-nums">(x{player.multiplier})</span>}
            </span>
            <span className="mt-1.5 flex flex-wrap items-center gap-1">
              {player.isCaptain && <Pill tone="captain">{tr("C 주장", "C")}</Pill>}
              {!player.isCaptain && player.isVice && <Pill tone="vice">{tr("VC 부주장", "VC")}</Pill>}
              <Pill tone={status.tone}>{tr(status.ko, status.en)}</Pill>
              {benchOrder !== undefined && <Pill tone="muted">{tr(`${benchOrder}번`, `#${benchOrder}`)}</Pill>}
            </span>
          </span>
        </button>
      </li>
    );
  };

  return (
    <div className="mt-4 space-y-6">
      <section aria-label={tr("결과 요약", "Result summary")}>
        <StepHeading step={1} title={tr("결과 요약", "Result summary")} hint={tr("이번 주 점수와 평균·지난주 비교", "This week's score against the average and last week")} />
        <Summary snapshot={snapshot} previous={previous ?? null} />
      </section>

      <section aria-label={tr("선수", "Players")}>
        <StepHeading
          step={2}
          title={tr("선수", "Players")}
          hint={hasPlayers ? tr("카드를 누르면 득점 상세가 열립니다", "Tap a card to see its points breakdown") : undefined}
        />
        {!hasPlayers ? (
          <p className="mt-3 rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-meta text-[var(--muted)]">
            {tr("이 주는 선수별 상세가 아직 저장되지 않았습니다.", "Player details have not been saved for this week yet.")}
          </p>
        ) : (
          <>
            <p className="mt-3 text-meta font-semibold">{tr(`선발 ${starters.length}명`, `Starting ${starters.length}`)}</p>
            <ul className="mt-1.5 grid grid-cols-2 gap-2 md:grid-cols-3">{starters.sort((a, b) => a.slot - b.slot).map((player) => card(player))}</ul>
            <p className="mt-4 border-t border-dashed border-[var(--border)] pt-3 text-meta font-semibold">{tr("후보 (교체 순서)", "Bench (substitution order)")}</p>
            <ul className="mt-1.5 grid grid-cols-2 gap-2 md:grid-cols-4">{bench.map((player, index) => card(player, index + 1))}</ul>
            {open && <PlayerLedger player={open} snapshot={snapshot} />}
          </>
        )}
      </section>

      {hasPlayers && <Results snapshot={snapshot} players={players!} />}
    </div>
  );
}

function playerStatus(player: SnapshotPlayer, subbedIn: boolean, subbedOut: boolean): { ko: string; en: string; tone: PillTone } {
  if (player.slot <= 11) {
    if (subbedOut) return { ko: "교체 아웃", en: "Sub out", tone: "danger" };
    return player.minutes > 0 ? { ko: "출전", en: "Played", tone: "played" } : { ko: "미출전", en: "Did not play", tone: "muted" };
  }
  if (subbedIn) return { ko: "교체 투입", en: "Sub in", tone: "accent" };
  return { ko: "벤치", en: "Bench", tone: "muted" };
}

type PillTone = "captain" | "vice" | "played" | "accent" | "danger" | "muted";

const PILL_TONES: Record<PillTone, string> = {
  captain: "bg-rose-600 text-white",
  vice: "bg-sky-600 text-white",
  played: "bg-emerald-100 text-emerald-800",
  accent: "bg-[var(--accent-soft)] text-[var(--accent-ink)]",
  danger: "bg-rose-100 text-[var(--danger)]",
  muted: "bg-slate-200 text-slate-600"
};

function Pill({ tone, children }: { tone: PillTone; children: ReactNode }) {
  return <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-caption font-semibold leading-4 ${PILL_TONES[tone]}`}>{children}</span>;
}

/** Up/down against a comparison value, always with an arrow and words so colour is never the only cue. */
function Delta({ diff, label, upIsGood = true }: { diff: number | null; label: string; upIsGood?: boolean }) {
  const { tr } = useLocale();
  if (diff === null) return null;
  if (diff === 0) return <span className="text-caption font-semibold text-[var(--muted)]">{tr(`${label} 같음`, `${label}: same`)}</span>;
  const good = diff > 0 === upIsGood;
  const arrow = diff > 0 ? "▲" : "▼";
  return (
    <span className={`text-caption font-semibold tabular-nums ${good ? "text-[var(--accent)]" : "text-[var(--danger)]"}`}>
      <span aria-hidden="true">{arrow} </span>
      {label} {diff > 0 ? "+" : "-"}
      {Math.abs(diff).toLocaleString()} {good ? tr("(좋음)", "(better)") : tr("(나쁨)", "(worse)")}
    </span>
  );
}

function Tile({ label, value, sub, className = "" }: { label: string; value: ReactNode; sub?: ReactNode; className?: string }) {
  return (
    <div className={`rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 ${className}`}>
      <dt className="text-caption text-[var(--muted)]">{label}</dt>
      <dd className="mt-0.5 text-title font-semibold tabular-nums leading-6">{value ?? "-"}</dd>
      {sub && <dd className="mt-0.5 leading-4">{sub}</dd>}
    </div>
  );
}

function Summary({ snapshot, previous }: { snapshot: WeeklySnapshot; previous: WeeklySnapshot | null }) {
  const { tr } = useLocale();
  const chip = snapshot.chip ? CHIP_LABELS[snapshot.chip] : null;
  const vsAverage = snapshot.average != null ? snapshot.points - snapshot.average : null;
  const vsHighest = snapshot.highest != null ? snapshot.points - snapshot.highest : null;
  const vsLast = previous ? snapshot.points - previous.points : null;
  // Overall rank: a smaller number is better, so "up" means the rank number fell.
  const rankMove = previous && previous.overallRank != null && snapshot.overallRank != null ? previous.overallRank - snapshot.overallRank : null;

  return (
    <div className="mt-3">
      <dl className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <div className="col-span-2 rounded-md border border-[var(--accent)] bg-[var(--accent-soft)] px-4 py-3 md:row-span-2">
          <dt className="text-meta font-semibold text-[var(--accent-ink)]">{tr("GW 점수", "GW points")}</dt>
          <dd className="mt-0.5 flex items-baseline gap-1.5 tabular-nums">
            <span className="text-5xl font-bold leading-none text-[var(--accent-ink)]">{snapshot.points}</span>
            <span className="text-body-lg font-semibold text-[var(--accent-ink)]">{tr("점", "pts")}</span>
            {snapshot.transferCost > 0 && <span className="ml-1 text-body-lg font-semibold text-[var(--danger)]">-{snapshot.transferCost}</span>}
          </dd>
          <dd className="mt-2 flex flex-col gap-0.5">
            {vsAverage !== null && <Delta diff={vsAverage} label={tr(`평균 ${snapshot.average}점 대비`, `vs avg ${snapshot.average}`)} />}
            {vsLast !== null && <Delta diff={vsLast} label={tr(`지난주(GW${previous!.gw}) 대비`, `vs GW${previous!.gw}`)} />}
            {snapshot.transferCost > 0 && (
              <span className="text-caption text-[var(--muted)]">{tr(`이적 감점 -${snapshot.transferCost} 반영한 점수`, `After a -${snapshot.transferCost} transfer hit`)}</span>
            )}
          </dd>
        </div>
        <Tile
          label={tr("GW 순위", "GW rank")}
          value={snapshot.gwRank?.toLocaleString() ?? "-"}
          sub={snapshot.average != null ? <span className="text-caption text-[var(--muted)]">{tr(`평균 ${snapshot.average}점`, `Average ${snapshot.average}`)}</span> : undefined}
        />
        <Tile
          label={tr("최고", "Highest")}
          value={snapshot.highest ?? "-"}
          sub={vsHighest !== null ? <span className="text-caption text-[var(--muted)]">{tr(`최고와 ${Math.abs(vsHighest)}점 차`, `${Math.abs(vsHighest)} behind top`)}</span> : undefined}
        />
        <Tile
          label={tr("이적", "Transfers")}
          value={tr(`${snapshot.transfers}회`, String(snapshot.transfers))}
          sub={
            <span className={`text-caption ${snapshot.transferCost > 0 ? "font-semibold text-[var(--danger)]" : "text-[var(--muted)]"}`}>
              {snapshot.transferCost > 0 ? tr(`이적 감점 -${snapshot.transferCost}`, `Hit -${snapshot.transferCost}`) : tr("감점 없음", "No hit")}
            </span>
          }
        />
        <Tile label={tr("벤치 점수", "Bench points")} value={snapshot.benchPoints} sub={<span className="text-caption text-[var(--muted)]">{tr("뛰지 않은 후보", "Left on the bench")}</span>} />
        <Tile className="md:col-span-2" label={tr("누적 점수", "Total points")} value={snapshot.totalPoints} />
        <Tile
          className="md:col-span-2"
          label={tr("전체 순위", "Overall rank")}
          value={snapshot.overallRank?.toLocaleString() ?? "-"}
          sub={rankMove !== null ? <Delta diff={rankMove} label={tr("지난주 대비", "vs last week")} /> : undefined}
        />
      </dl>
      {chip && (
        <p className="mt-2 inline-block rounded-md bg-[var(--accent-soft)] px-2 py-1 text-meta font-semibold text-[var(--accent-ink)]">
          {tr("칩 사용", "Chip played")}: {tr(chip[0], chip[1])}
        </p>
      )}
    </div>
  );
}

function PlayerLedger({ player, snapshot }: { player: SnapshotPlayer; snapshot: WeeklySnapshot }) {
  const { tr, locale } = useLocale();
  const clubs = snapshot.teams ?? {};
  const byFixture = new Map(snapshot.fixtures.map((fixture) => [fixture.id, fixture]));
  const total = player.fixtures.reduce((sum, fixture) => sum + fixture.stats.reduce((inner, stat) => inner + stat.points, 0), 0);
  return (
    <section aria-label={player.name} className="mt-3 rounded-md border border-[var(--accent)] bg-[var(--bg)] p-3">
      <h4 className="text-body-lg font-semibold">
        {player.name} <span className="font-normal text-[var(--muted)]">{player.team}</span>
      </h4>
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

type MyPlayer = { name: string; points: number; goals: number; assists: number };

function TeamSide({ name, align }: { name: string; align: "left" | "right" }) {
  return (
    <span className={`flex min-w-0 items-center ${align === "right" ? "justify-end text-right" : ""}`}>
      <span className="min-w-0 truncate text-body-lg font-semibold">{name}</span>
    </span>
  );
}

function Results({ snapshot, players }: { snapshot: WeeklySnapshot; players: SnapshotPlayer[] }) {
  const { tr, locale } = useLocale();
  const clubs = snapshot.teams;
  if (!clubs || snapshot.fixtures.length === 0) return null;
  // A fixture counts as "mine" when one of my squad actually played minutes in it.
  const mine = new Map<number, MyPlayer[]>();
  for (const player of players) {
    for (const entry of player.fixtures) {
      const minutes = entry.stats.find((stat) => stat.id === "minutes")?.value ?? 0;
      if (minutes <= 0) continue;
      const item: MyPlayer = {
        name: player.name,
        points: entry.stats.reduce((sum, stat) => sum + stat.points, 0),
        goals: entry.stats.find((stat) => stat.id === "goals_scored")?.value ?? 0,
        assists: entry.stats.find((stat) => stat.id === "assists")?.value ?? 0
      };
      mine.set(entry.fixture, [...(mine.get(entry.fixture) ?? []), item]);
    }
  }
  const dayFormat = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "ko-KR", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

  return (
    <section aria-label={tr("경기 결과", "Results")}>
      <StepHeading
        step={3}
        title={tr(`GW${snapshot.gw} 경기 결과`, `GW${snapshot.gw} results`)}
        hint={tr("내 선수가 뛴 경기와 득점·도움", "Matches my players played, with goals and assists")}
      />
      {groupFixturesByDay(snapshot.fixtures).map(({ day, items }) => (
        <div key={day || "unknown"} className="mt-3">
          {day && <p className="text-body-lg font-semibold">{formatDay(dayFormat, day)}</p>}
          <ul className="mt-1.5 grid gap-2 md:grid-cols-2">
            {items.map((fixture) => {
              const own = mine.get(fixture.id) ?? [];
              return (
                <li key={fixture.id} className="rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2 text-caption">
                    <span className={own.length > 0 ? "font-semibold text-[var(--accent)]" : "text-[var(--muted)]"}>
                      {own.length > 0 ? tr(`내 선수 ${own.length}명 보유`, `My players: ${own.length}`) : tr("내 선수 없음", "No players of mine")}
                    </span>
                    {fixture.finished && (
                      <span className="shrink-0 rounded-md bg-[var(--surface-strong)] px-2 py-0.5 font-semibold text-[var(--text)]">{tr("종료", "FT")}</span>
                    )}
                  </div>
                  <div className="mt-1.5 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                    <TeamSide name={clubs[String(fixture.teamH)] ?? "-"} align="left" />
                    <span className="shrink-0 rounded-md bg-[var(--accent)]/10 px-3 py-1 text-body-lg font-bold tabular-nums text-[var(--accent)]">
                      {fixture.scoreH !== null && fixture.scoreA !== null ? `${fixture.scoreH} - ${fixture.scoreA}` : "v"}
                    </span>
                    <TeamSide name={clubs[String(fixture.teamA)] ?? "-"} align="right" />
                  </div>
                  {own.length > 0 && (
                    <ul className="mt-2 flex flex-wrap gap-1.5 border-t border-dashed border-[var(--border)] pt-2" aria-label={tr("내 선수", "My players")}>
                      {own.map((player) => {
                        const scored = player.goals > 0 || player.assists > 0;
                        return (
                          <li
                            key={player.name}
                            className={`rounded-md px-2 py-0.5 text-caption ${scored ? "bg-[var(--accent-soft)] font-semibold text-[var(--accent-ink)]" : "bg-[var(--surface)] text-[var(--muted)]"}`}
                          >
                            {player.name}
                            {player.goals > 0 && ` ${tr("골", "G")} ${player.goals}`}
                            {player.assists > 0 && ` ${tr("도움", "A")} ${player.assists}`}
                            <span className="tabular-nums"> · {player.points}{tr("점", "p")}</span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </section>
  );
}
