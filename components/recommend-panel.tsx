"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AiOpinionPanel } from "@/components/ai-opinion-panel";
import { useLocale } from "@/components/locale-provider";
import { MemberOnlyNotice } from "@/components/member-only-notice";
import { RecommendLogPanel } from "@/components/recommend-log-panel";
import { Badge, fmtSigned, fmtTime, fmtXp, FixtureText, playerLookup, PlayerTag, SubHeading, type PlayerShown } from "@/components/recommend-parts";
import type { FdrHorizon } from "@/lib/squad-view";
import { LineupReasonList } from "@/components/scenario-pitch";
import { TransferScenarios } from "@/components/recommend-transfers";
import { isAllowedEntry } from "@/lib/ai/allowed-entry";
import { assumptionText } from "@/lib/recommend-text";
import type { LineupCandidate } from "@/lib/xp/lineup";
import { buildLineupReasons } from "@/lib/xp/lineup-reasons";
import type { EntryRecommendPayload } from "@/lib/xp/recommend";

/**
 * Recommendation panel of /team/[id] (issue #43, stage 4): the rules-based lineup, captain and transfer
 * candidates, then the AI opinion beside them. Drawn only for the member who registered this team (issue #47, decided by
 * the caller from /api/journal/me). The server checks that too: a 401 or 403 here (a session that ran out, a team changed
 * in another tab) turns the panel into the quiet "members only" line instead of an error screen. The AI opinion and the
 * recommendation log belong to the allowed team only.
 */

class RecommendRequestError extends Error {
  constructor(readonly status: number) {
    super(`recommend request failed (${status})`);
  }
}

async function fetchRecommend(entryId: number, horizon: 3 | 5): Promise<EntryRecommendPayload> {
  const response = await fetch(`/api/entry-recommend?entryId=${entryId}&horizon=${horizon}`);
  if (!response.ok) {
    throw new RecommendRequestError(response.status);
  }
  return (await response.json()) as EntryRecommendPayload;
}

function LineupChanges({ lineup, lookup, xpOf }: { lineup: LineupCandidate; lookup: (id: number) => PlayerShown; xpOf: (id: number) => number }) {
  const { tr } = useLocale();
  if (lineup.changes.length === 0) {
    return <p className="text-meta text-[var(--muted)]">{tr("지금 선발과 같습니다. 바꿀 자리가 없습니다.", "Same as the current XI: nothing to change.")}</p>;
  }
  return (
    <ul className="flex list-none flex-col gap-1 p-0 text-meta">
      {lineup.changes.map((change) => (
        <li key={`${change.out}-${change.in}`} className="min-w-0 break-words">
          <PlayerTag player={lookup(change.out)} /> ({fmtXp(xpOf(change.out))}) <span aria-label={tr("에서", "to")}>→</span>{" "}
          <PlayerTag player={lookup(change.in)} /> ({fmtXp(xpOf(change.in))})
        </li>
      ))}
    </ul>
  );
}

function LineupSection({ payload }: { payload: EntryRecommendPayload }) {
  const { tr, locale } = useLocale();
  const lookup = playerLookup(payload);
  const xp = new Map(payload.players.map((player) => [player.elementId, player.xpNext]));
  const xpOf = (id: number) => xp.get(id) ?? 0;
  const [best, ...others] = payload.lineups;
  const rollLineup = payload.scenarioLineups?.roll;
  if (!best) return null;

  return (
    <div className="flex flex-col gap-1.5">
      <SubHeading>{tr("추천 선발·벤치", "Recommended XI and bench")}</SubHeading>
      <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
        <p className="flex flex-wrap items-center gap-1.5 text-body">
          <span className="font-semibold">{tr(`포메이션 ${best.formation}`, `Formation ${best.formation}`)}</span>
          <span className="tabular-nums">
            {tr(`선발 기대 점수 ${fmtXp(best.expectedPoints)}`, `XI expected points ${fmtXp(best.expectedPoints)}`)}
          </span>
          <Badge tone={best.gain > 0 ? "accent" : "plain"}>
            {tr(`지금 선발 대비 ${fmtSigned(best.gain)}`, `${fmtSigned(best.gain)} vs current XI`)}
          </Badge>
        </p>
        <div className="mt-1.5">
          <LineupChanges lineup={best} lookup={lookup} xpOf={xpOf} />
        </div>
        <p className="mt-1.5 text-meta">
          <span className="text-[var(--muted)]">{tr("벤치 순서", "Bench order")}: </span>
          {best.bench.map((id, index) => (
            <span key={id}>
              {index > 0 ? " > " : null}
              {lookup(id).name}
            </span>
          ))}
        </p>
        {rollLineup && payload.lineupPlayers ? (
          <div className="mt-1.5">
            <LineupReasonList reasons={buildLineupReasons(rollLineup, payload.lineupPlayers, locale)} />
          </div>
        ) : null}
      </div>

      {others.length > 0 ? (
        <details className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
          <summary className="cursor-pointer text-meta font-semibold">{tr("다른 선발안 (L2·L3)", "Other lineups (L2, L3)")}</summary>
          <div className="mt-1.5 flex flex-col gap-2">
            {others.map((lineup) => (
              <div key={lineup.rank}>
                <p className="text-meta">
                  <span className="font-semibold">{`L${lineup.rank} · ${lineup.formation}`}</span>{" "}
                  <span className="tabular-nums">
                    {tr(
                      `기대 점수 ${fmtXp(lineup.expectedPoints)} (지금 선발 대비 ${fmtSigned(lineup.gain)})`,
                      `xP ${fmtXp(lineup.expectedPoints)} (${fmtSigned(lineup.gain)} vs current XI)`
                    )}
                  </span>
                </p>
                <LineupChanges lineup={lineup} lookup={lookup} xpOf={xpOf} />
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}

function CaptainSection({ payload }: { payload: EntryRecommendPayload }) {
  const { tr } = useLocale();
  const lookup = playerLookup(payload);
  const top = payload.captains.slice(0, 3);
  if (top.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5">
      <SubHeading>{tr("캡틴 1~3순위", "Captain picks 1-3")}</SubHeading>
      <ol className="flex list-none flex-col gap-1 p-0">
        {top.map((captain) => (
          <li
            key={captain.id}
            className="grid min-w-0 grid-cols-[1.5rem_minmax(0,1fr)_auto] items-baseline gap-x-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5"
          >
            <span className="text-body font-semibold tabular-nums">{captain.rank}</span>
            <span className="min-w-0 text-meta">
              <PlayerTag player={lookup(captain.id)} />
              <span className="block text-caption text-[var(--muted)]">
                <FixtureText fixtures={captain.fixtures} />
              </span>
            </span>
            <span className="text-right text-meta tabular-nums">
              <span className="block">{tr(`기대 점수 ${fmtXp(captain.xp)}`, `xP ${fmtXp(captain.xp)}`)}</span>
              <span className="block text-caption text-[var(--muted)]">{tr(`추천 비중 ${captain.weightPct}%`, `Weight ${captain.weightPct}%`)}</span>
            </span>
          </li>
        ))}
      </ol>
      <p className="text-caption text-[var(--muted)]">
        {tr("추천 비중은 다섯 후보 사이의 상대 비중이며 확률이 아닙니다.", "The weight is a relative share among five candidates, not a probability.")}
      </p>
    </div>
  );
}

export function RecommendPanel({ entryId, fdrHorizon = 3, onFdrHorizon }: { entryId: number; fdrHorizon?: FdrHorizon; onFdrHorizon?: (next: FdrHorizon) => void }) {
  const { tr, locale } = useLocale();
  const [horizon, setHorizon] = useState<3 | 5>(3);

  const query = useQuery({
    queryKey: ["entry-recommend", entryId, horizon],
    queryFn: () => fetchRecommend(entryId, horizon),
    staleTime: 60_000,
    retry: false,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData
  });
  const data = query.data;
  const lookup = data ? playerLookup(data) : null;

  if (query.error instanceof RecommendRequestError && (query.error.status === 401 || query.error.status === 403)) {
    return <MemberOnlyNotice />;
  }

  return (
    <section aria-label={tr("추천", "Recommendations")} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="text-title font-semibold">{tr("추천: 선발·캡틴·이적", "Recommendations: lineup, captain, transfers")}</h2>
        <p role="note" className="rounded-md border border-[var(--info-border)] bg-[var(--info-soft)] px-3 py-2 text-meta leading-5">
          {data
            ? tr(
                `아래는 추정·참고용 분석입니다. 최종 결정은 직접 하세요. 지난 마감(GW${data.squadGw ?? "-"}) 팀 기준이며 판매가·무료 이적 수는 추정입니다.`,
                `The analysis below is an estimate for reference. The final call is yours. It is based on the squad at the last deadline (GW${data.squadGw ?? "-"}); selling prices and free transfers are estimates.`
              )
            : tr(
                "아래는 추정·참고용 분석입니다. 최종 결정은 직접 하세요. 지난 마감 팀 기준이며 판매가·무료 이적 수는 추정입니다.",
                "The analysis below is an estimate for reference. The final call is yours. It is based on the squad at the last deadline; selling prices and free transfers are estimates."
              )}
          {" "}
          {tr(
            "기대 점수는 최근 성적과 일정만 반영한 단순 추정이라 비싼 선수를 낮게 볼 수 있습니다.",
            "Expected points use only recent form and fixtures, a simple estimate that can under-rate expensive players."
          )}
        </p>
        {data ? (
          <p className="text-caption text-[var(--muted)]">
            {tr(
              `추천 대상 GW${data.targetGw} · 데이터 시각: 팀 ${fmtTime(data.squadFetchedAt, locale)}, 기대 점수 ${fmtTime(data.xpBuiltAt, locale)}`,
              `For GW${data.targetGw} · data time: squad ${fmtTime(data.squadFetchedAt, locale)}, xP ${fmtTime(data.xpBuiltAt, locale)}`
            )}
          </p>
        ) : null}
      </div>

      {query.isPending ? (
        <p role="status" className="py-4 text-center text-body text-[var(--muted)]">
          {tr("추천을 계산하는 중…", "Working out the recommendation…")}
        </p>
      ) : query.isError && !data ? (
        <div role="alert" className="rounded-md border border-[var(--border)] px-4 py-4 text-center">
          <p className="text-body">
            {query.error instanceof RecommendRequestError && query.error.status === 429
              ? tr("요청이 많아 잠시 막혔습니다. 잠시 뒤 다시 시도해 주세요.", "Too many requests. Try again shortly.")
              : tr("추천을 불러오지 못했습니다. 잠시 뒤 다시 시도해 주세요.", "Could not load the recommendation. Try again in a moment.")}
          </p>
          <button
            type="button"
            onClick={() => void query.refetch()}
            className="mt-2 h-10 rounded-md border border-[var(--border)] bg-[var(--surface-strong)] px-4 text-body font-semibold"
          >
            {tr("다시 시도", "Retry")}
          </button>
        </div>
      ) : data && lookup ? (
        <>
          <LineupSection payload={data} />
          <CaptainSection payload={data} />

          <div className="flex flex-col gap-1.5">
            <SubHeading>{tr("이적 시나리오", "Transfer scenarios")}</SubHeading>
            {data.transfers ? (
              <TransferScenarios
                result={data.transfers}
                lookup={lookup}
                horizon={horizon}
                onHorizon={setHorizon}
                fdrHorizon={fdrHorizon}
                onFdrHorizon={onFdrHorizon}
                scenarioLineups={data.scenarioLineups}
                lineupPlayers={data.lineupPlayers}
                chipExplanations={data.chipExplanations}
                squadStats={Object.fromEntries(data.players.map((player) => [player.elementId, { xp: player.xpNext, cost: data.playerInfo?.[String(player.elementId)]?.nowCost ?? null }]))}
              />
            ) : (
              <p className="text-meta text-[var(--muted)]">
                {tr("이 팀은 15명 스쿼드가 아직 없어 이적 시나리오를 계산하지 못했습니다.", "This team has no full 15-player squad yet, so no transfer scenarios were computed.")}
              </p>
            )}
            {query.isFetching ? <p role="status" className="text-caption text-[var(--muted)]">{tr("다시 계산하는 중…", "Recalculating…")}</p> : null}
          </div>

          <details className="text-meta">
            <summary className="cursor-pointer font-semibold">{tr("가정과 한계", "Assumptions and limits")}</summary>
            <ul className="mt-1 flex list-disc flex-col gap-0.5 pl-5 text-[var(--muted)]">
              {data.assumptions.map((assumption) => (
                <li key={assumption.code}>{assumptionText(assumption.code, assumption.text, locale)}</li>
              ))}
            </ul>
          </details>
        </>
      ) : null}

      {isAllowedEntry(entryId) ? <AiOpinionPanel entryId={entryId} /> : null}
      {isAllowedEntry(entryId) ? <RecommendLogPanel entryId={entryId} /> : null}
    </section>
  );
}
