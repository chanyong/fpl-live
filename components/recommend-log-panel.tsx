"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useLocale } from "@/components/locale-provider";
import type { ActualResult, ActualTransfer, Comparison, LogEntryView, LogScenario, RecommendLogResponse } from "@/lib/ai/rec-log";

/**
 * "지난 추천 기록(참고)": a folded section under the recommendation panel (issue #43, stage 5). One line group per
 * gameweek, newest first: what the rules recommended, what really happened, and the AI's choice beside it when
 * there was one. It is a reference record, not a verdict: the sample is one team and one gameweek per line.
 * The record is fetched only when the section is opened, so a page view alone costs no log request.
 */

async function fetchLog(entryId: number): Promise<RecommendLogResponse> {
  const response = await fetch(`/api/entry-recommend-log?entryId=${entryId}`);
  if (!response.ok) {
    throw new Error(`log request failed (${response.status})`);
  }
  return (await response.json()) as RecommendLogResponse;
}

const signed = (value: number) => `${value >= 0 ? "+" : "-"}${Math.abs(value)}`;

type Tr = <T = string>(ko: T, en: T) => T;

function namer(entry: LogEntryView) {
  return (id: number) => entry.summary.names?.[String(id)] ?? `#${id}`;
}

function comparisonText(vs: Comparison, tr: Tr) {
  return vs === "better" ? tr("수치 기준보다 나음", "better than the numbers") : vs === "same" ? tr("수치 기준과 같음", "same as the numbers") : tr("수치 기준보다 못함", "worse than the numbers");
}

function TransferLine({ label, scenario, actual, name, tr }: { label: string; scenario: LogScenario | null; actual: ActualTransfer | null | undefined; name: (id: number) => string; tr: Tr }) {
  if (!scenario) return null;
  const moves = `${scenario.out.map(name).join(", ")} → ${scenario.in.map(name).join(", ")}`;
  return (
    <p className="min-w-0 break-words">
      <span className="font-semibold">{label}</span>: {moves}
      {actual
        ? tr(
            ` · 실제 순이익 ${signed(actual.net)}점 (들어온 선수 ${actual.inPoints}점 − 나간 선수 ${actual.outPoints}점 − 비용 ${actual.cost}점)`,
            ` · real net ${signed(actual.net)} (in ${actual.inPoints} − out ${actual.outPoints} − cost ${actual.cost})`
          )
        : ""}
    </p>
  );
}

function ActualLines({ entry, actual, tr }: { entry: LogEntryView; actual: ActualResult; tr: Tr }) {
  const name = namer(entry);
  const top = actual.captainTop;
  const best = actual.captains.reduce<{ id: number; points: number } | null>((found, captain) => (!found || captain.points > found.points ? captain : found), null);
  const ai = actual.ai;
  const aiSummary = entry.summary.ai;

  return (
    <>
      {top ? (
        <p className="min-w-0 break-words">
          <span className="font-semibold">{tr("캡틴", "Captain")}</span>: {tr(`수치 1순위 ${name(top.id)} 실제 ${top.points}점`, `top pick ${name(top.id)} scored ${top.points}`)} ·{" "}
          {top.bestAmongCandidates
            ? tr("후보 중 최고였음", "the best of the candidates")
            : tr(`후보 중 최고는 아니었음 (최고 ${best ? `${name(best.id)} ${best.points}점` : "-"})`, `not the best of the candidates (best ${best ? `${name(best.id)} ${best.points}` : "-"})`)}
        </p>
      ) : null}

      {actual.lineup ? (
        <p className="min-w-0 break-words">
          <span className="font-semibold">{tr("선발", "Lineup")}</span>:{" "}
          {tr(
            `추천 선발 ${actual.lineup.points}점 / 최적 ${actual.lineup.optimalPoints}점${actual.lineup.ratio === null ? "" : ` (${Math.round(actual.lineup.ratio * 100)}%)`}`,
            `recommended XI ${actual.lineup.points} / best XI ${actual.lineup.optimalPoints}${actual.lineup.ratio === null ? "" : ` (${Math.round(actual.lineup.ratio * 100)}%)`}`
          )}
        </p>
      ) : null}

      <TransferLine label={tr("1명 이적 1순위", "Best 1 transfer")} scenario={entry.summary.transfers?.one ?? null} actual={actual.transfers?.one} name={name} tr={tr} />
      <TransferLine label={tr("2명 이적 1순위", "Best 2 transfers")} scenario={entry.summary.transfers?.two ?? null} actual={actual.transfers?.two} name={name} tr={tr} />

      {aiSummary ? (
        <div className="min-w-0 break-words rounded-sm bg-[var(--surface-strong)] px-2 py-1">
          <p className="font-semibold">{tr("AI", "AI")}</p>
          {ai?.captain ? (
            <p>
              {tr(`캡틴 ${name(ai.captain.id)} 실제 ${ai.captain.points}점`, `Captain ${name(ai.captain.id)} scored ${ai.captain.points}`)} ({comparisonText(ai.captain.vs, tr)})
            </p>
          ) : null}
          {ai?.lineup ? (
            <p>
              {tr(`선발 ${aiSummary.lineupId} 실제 ${ai.lineup.points}점`, `Lineup ${aiSummary.lineupId} scored ${ai.lineup.points}`)} ({comparisonText(ai.lineup.vs, tr)})
            </p>
          ) : null}
          {ai?.transfer ? (
            <p>
              {tr(`이적 1순위 실제 순이익 ${signed(ai.transfer.net)}점`, `First transfer priority: real net ${signed(ai.transfer.net)}`)} ({comparisonText(ai.transfer.vs, tr)})
            </p>
          ) : null}
          {!ai?.captain && !ai?.lineup && !ai?.transfer ? <p className="text-[var(--muted)]">{tr("비교할 값이 없습니다.", "Nothing to compare.")}</p> : null}
        </div>
      ) : null}

      {actual.manager ? (
        <p className="min-w-0 break-words text-[var(--muted)]">
          {tr("그 주 실제 내 선택", "What you really played")}:{" "}
          {actual.manager.captainId !== null
            ? tr(`캡틴 ${name(actual.manager.captainId)} ${actual.manager.captainPoints ?? "-"}점`, `captain ${name(actual.manager.captainId)} ${actual.manager.captainPoints ?? "-"}`)
            : tr("캡틴 정보 없음", "no captain data")}
          {actual.manager.points !== null ? tr(` · 팀 ${actual.manager.points}점`, ` · team ${actual.manager.points}`) : ""}
        </p>
      ) : null}
    </>
  );
}

function WaitingLines({ entry, tr }: { entry: LogEntryView; tr: Tr }) {
  const name = namer(entry);
  const top = entry.summary.captains[0];
  const ai = entry.summary.ai;
  return (
    <>
      <p className="min-w-0 break-words">
        <span className="font-semibold">{tr("캡틴", "Captain")}</span>: {top ? tr(`수치 1순위 ${name(top.id)}`, `top pick ${name(top.id)}`) : "-"}
        {ai?.captains[0] !== undefined ? ` · AI ${name(ai.captains[0])}` : ""}
      </p>
      <p className="text-[var(--muted)]">{tr("결과 대기 중: GW가 끝나면 실제 점수가 채워집니다.", "Waiting for the result: the real points are filled in once the gameweek ends.")}</p>
    </>
  );
}

function LogEntry({ entry }: { entry: LogEntryView }) {
  const { tr } = useLocale();
  return (
    <li className="flex min-w-0 flex-col gap-1 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-meta">
      <p className="text-body font-semibold">{`GW${entry.targetGw}`}</p>
      {entry.actual ? <ActualLines entry={entry} actual={entry.actual} tr={tr} /> : <WaitingLines entry={entry} tr={tr} />}
    </li>
  );
}

export function RecommendLogPanel({ entryId }: { entryId: number }) {
  const { tr } = useLocale();
  const [opened, setOpened] = useState(false);

  const query = useQuery({
    queryKey: ["entry-recommend-log", entryId],
    queryFn: () => fetchLog(entryId),
    enabled: opened,
    staleTime: 60_000,
    retry: false,
    refetchOnWindowFocus: false
  });
  const entries = query.data?.entries ?? [];

  return (
    <details className="border-t border-[var(--border)] pt-3 text-meta">
      <summary onClick={() => setOpened(true)} className="cursor-pointer text-body font-semibold">
        {tr("지난 추천 기록(참고)", "Past recommendations (for reference)")}
      </summary>
      <div className="mt-2 flex flex-col gap-2">
        <p className="rounded-md border border-[var(--info-border)] bg-[var(--info-soft)] px-3 py-2 leading-5">
          {tr(
            "표본이 작아 참고용입니다. 한 팀·GW당 1건이라 한 시즌으로도 통계적 결론은 약합니다.",
            "The sample is small, so this is for reference only. It is one team and one entry per gameweek, so even a whole season is too little for a statistical conclusion."
          )}
        </p>

        {query.isPending && opened ? (
          <p role="status" className="text-[var(--muted)]">
            {tr("기록을 불러오는 중…", "Loading the record…")}
          </p>
        ) : query.isError ? (
          <p role="alert" className="text-[var(--muted)]">
            {tr("기록을 불러오지 못했습니다. 잠시 뒤 다시 열어 주세요.", "Could not load the record. Open it again in a moment.")}
          </p>
        ) : entries.length === 0 ? (
          <p className="text-[var(--muted)]">{tr("아직 기록이 없습니다. 다음 GW가 끝나면 채워집니다.", "No record yet. It fills in after the next gameweek ends.")}</p>
        ) : (
          <>
            <ul className="flex list-none flex-col gap-1.5 p-0">
              {entries.map((entry) => (
                <LogEntry key={entry.targetGw} entry={entry} />
              ))}
            </ul>
            <p className="text-caption text-[var(--muted)]">
              {tr(
                "점수는 선수 점수 기준입니다(캡틴 2배·자동 교체 제외). 기록은 마감 전 마지막 방문 때의 추천입니다.",
                "Points are player points (no captain doubling, no automatic substitutions). The record is the recommendation at the last visit before the deadline."
              )}
            </p>
          </>
        )}
      </div>
    </details>
  );
}
