"use client";

import { useState } from "react";
import { useLocale } from "@/components/locale-provider";
import { Badge, fmtMoney, fmtSigned, fmtTime, fmtXp, SubHeading } from "@/components/recommend-parts";
import { ScenarioPitch } from "@/components/scenario-pitch";
import type { FullDonePayload } from "@/lib/ai/full-flow";
import type { FullAiResult } from "@/lib/ai/full-schema";
import { chipLabel } from "@/lib/chips";
import type { FdrHorizon } from "@/lib/squad-view";

/**
 * The "full AI" answer on /team/[id] (issue #85): the plan the AI chose (transfers or a chip, the XI, the bench,
 * the armband), drawn with the same pitch as the transfer scenarios, a reason for every player, and what it
 * changes against the rules engine's best option. The figures (expected points, cost, bank) are the server's;
 * the sentences are the model's and are drawn as plain text.
 */

const ROLE_ORDER = ["starter", "bench", "in", "out"] as const;
type RoleGroup = (typeof ROLE_ORDER)[number];

function groupOf(reason: FullAiResult["reasons"][number]): RoleGroup {
  if (reason.role === "out") return "out";
  return reason.incoming ? "in" : reason.role;
}

function CompareTable({ result }: { result: FullAiResult }) {
  const { tr } = useLocale();
  if (!result.money) return null;
  const ai = { xp: result.lineup.expectedPoints, cost: result.money.transferCost, bank: result.money.bankAfter };
  const rules = result.rules;
  const rows: Array<{ key: string; label: string; ai: string; rules: string; diff: string }> = [
    {
      key: "xp",
      label: tr("선발 기대 점수", "XI expected points"),
      ai: fmtXp(ai.xp),
      rules: fmtXp(rules.xp),
      diff: fmtSigned(ai.xp - rules.xp)
    },
    {
      key: "cost",
      label: tr("이적 감점", "Transfer cost"),
      ai: `-${ai.cost}`,
      rules: `-${rules.transferCost}`,
      diff: fmtSigned(rules.transferCost - ai.cost)
    },
    {
      key: "net",
      label: tr("기대 점수 − 감점", "Expected points minus cost"),
      ai: fmtXp(ai.xp - ai.cost),
      rules: fmtXp(rules.xp - rules.transferCost),
      diff: fmtSigned(ai.xp - ai.cost - (rules.xp - rules.transferCost))
    },
    {
      key: "bank",
      label: tr("이적 뒤 은행", "Bank afterwards"),
      ai: fmtMoney(ai.bank),
      rules: fmtMoney(rules.bankAfter),
      diff: `${ai.bank - rules.bankAfter >= 0 ? "+" : "-"}${fmtMoney(Math.abs(ai.bank - rules.bankAfter))}`
    }
  ];
  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2" data-full-compare>
      <SubHeading>{tr("규칙 엔진 최선안과의 차이", "Difference from the rules engine's best option")}</SubHeading>
      <div className="mt-1 overflow-x-auto">
        <table className="w-full min-w-[20rem] border-collapse text-meta tabular-nums">
          <thead>
            <tr className="text-left text-caption text-[var(--muted)]">
              <th className="py-1 pr-2 font-semibold">{tr("항목", "Item")}</th>
              <th className="py-1 pr-2 font-semibold">{tr("AI 선택", "AI choice")}</th>
              <th className="py-1 pr-2 font-semibold">{tr("규칙 엔진", "Rules engine")}</th>
              <th className="py-1 font-semibold">{tr("차이", "Diff")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-t border-[var(--border)]">
                <th className="py-1 pr-2 text-left font-normal">{row.label}</th>
                <td className="py-1 pr-2">{row.ai}</td>
                <td className="py-1 pr-2">{row.rules}</td>
                <td className="py-1 font-semibold">{row.diff}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-1 text-caption text-[var(--muted)]">
        {tr(
          "기대 점수는 규칙 기반 추정(다음 GW)이고, 이 비교는 AI가 더 낫다는 보증이 아닙니다.",
          "Expected points are rules-based estimates for the next gameweek; this comparison does not promise the AI is better."
        )}
      </p>
    </div>
  );
}

export function AiFullView({ done }: { done: FullDonePayload }) {
  const { tr, locale } = useLocale();
  const [fdrHorizon, setFdrHorizon] = useState<FdrHorizon>(3);
  const result = done.result;
  const name = (id: number) => result.cards[String(id)]?.webName ?? `#${id}`;
  const chipName = result.chip === "none" ? null : chipLabel(result.chip, false, locale);

  const inReasons: Record<number, string> = {};
  for (const reason of result.reasons) {
    if (reason.incoming && reason.role !== "out") inReasons[reason.playerId] = reason.reason;
  }
  const groupTitle: Record<RoleGroup, string> = {
    starter: tr("선발", "Starters"),
    bench: tr("벤치 (순서대로)", "Bench (in order)"),
    in: tr("IN (새로 영입)", "IN (new signings)"),
    out: tr("OUT (내보냄)", "OUT (sold)")
  };
  const isRoll = result.transfers.length === 0 && result.chip === "none" && result.verified;
  const label = result.verified ? tr("AI 전체 추천", "AI full plan") : tr("규칙 엔진 최선안", "Rules engine's best option");

  return (
    <div className="flex flex-col gap-3" data-ai-full data-verified={result.verified ? "yes" : "no"}>
      <p className="text-caption text-[var(--muted)]">
        {tr(
          `Claude Fable 5.2 전체 추천 · 분석 시각 ${fmtTime(done.completedAt, locale)} · GW${done.targetGw} 대상`,
          `Full AI plan by Claude Fable 5.2 · analysed ${fmtTime(done.completedAt, locale)} · for GW${done.targetGw}`
        )}
      </p>

      {result.verified ? null : (
        <div role="alert" className="flex flex-col gap-1 rounded-md border border-[var(--border)] px-3 py-2 text-meta" data-full-failed>
          <p className="flex flex-wrap items-center gap-1.5 font-semibold">
            <Badge tone="warn">{tr("검증 실패", "Check failed")}</Badge>
            {tr("AI의 선택이 FPL 규칙 검사를 통과하지 못해 규칙 엔진의 최선안으로 대체했습니다.", "The AI's choice did not pass the FPL rule check, so the rules engine's best option is shown instead.")}
          </p>
          <p className="text-caption text-[var(--muted)]">
            {tr("한 번 다시 물었지만 같은 결과였습니다. 아래 선발·벤치는 규칙 기반 값이고 AI 근거는 없습니다.", "It was asked once more with the same result. The lineup below is rules-based and carries no AI reasons.")}
            {result.failureCode ? ` (${result.failureCode})` : ""}
          </p>
        </div>
      )}

      {result.verified && result.summary ? (
        <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
          <SubHeading>{tr("요약", "Summary")}</SubHeading>
          <p className="mt-1 break-words text-body">{result.summary}</p>
        </div>
      ) : null}

      <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2" data-full-moves>
        <SubHeading>{tr("추천 이적", "Recommended transfers")}</SubHeading>
        {result.verified ? (
          <>
            <p className="mt-1 flex flex-wrap items-center gap-1.5 text-meta">
              {chipName ? <Badge tone="accent">{tr(`칩: ${chipName}`, `Chip: ${chipName}`)}</Badge> : <Badge>{tr("칩 사용 안 함", "No chip")}</Badge>}
              {result.transfers.length === 0 ? <span>{tr("이적 없음(넘기기)", "No transfer (roll)")}</span> : null}
              {result.money ? (
                <span className="tabular-nums">
                  {tr(
                    `이적 ${result.transfers.length}명 · 감점 -${result.money.transferCost} · 무료 이적 ${result.money.freeTransfers}개 가정 · 이적 뒤 은행 ${fmtMoney(result.money.bankAfter)}`,
                    `${result.transfers.length} transfer(s) · cost -${result.money.transferCost} · ${result.money.freeTransfers} free assumed · bank afterwards ${fmtMoney(result.money.bankAfter)}`
                  )}
                </span>
              ) : null}
            </p>
            {result.transfers.length > 0 ? (
              <ul className="mt-1 flex list-none flex-col gap-0.5 p-0 text-body">
                {result.transfers.map((transfer) => (
                  <li key={`${transfer.out}-${transfer.in}`} className="break-words">
                    <span className="text-[var(--muted)]">{name(transfer.out)}</span> → <span className="font-semibold">{name(transfer.in)}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        ) : result.fallbackMoves && (result.fallbackMoves.out.length > 0 || result.fallbackMoves.in.length > 0) ? (
          <p className="mt-1 break-words text-meta">
            {result.fallbackMoves.out.map(name).join(", ")} → {result.fallbackMoves.in.map(name).join(", ")}
          </p>
        ) : (
          <p className="mt-1 text-meta text-[var(--muted)]">{tr("이적 없음(넘기기)", "No transfer (roll)")}</p>
        )}
      </div>

      <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] p-2">
        <ScenarioPitch
          lineup={result.lineup}
          cards={result.cards}
          label={label}
          isRoll={isRoll || !result.verified}
          reasons={result.verified ? inReasons : undefined}
          fdrHorizon={fdrHorizon}
          onFdrHorizon={setFdrHorizon}
        />
      </div>

      {result.verified ? (
        <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2" data-full-reasons>
          <SubHeading>{tr("선수별 근거 (AI)", "Reason for each player (AI)")}</SubHeading>
          <div className="mt-1 flex flex-col gap-2">
            {ROLE_ORDER.map((group) => {
              const rows = result.reasons.filter((reason) => groupOf(reason) === group);
              if (rows.length === 0) return null;
              return (
                <div key={group} data-reason-group={group}>
                  <p className="text-meta font-semibold">{groupTitle[group]}</p>
                  <ul className="flex list-none flex-col gap-1 p-0 text-meta">
                    {rows.map((reason) => (
                      <li key={`${group}-${reason.playerId}`} className="break-words">
                        <span className="font-semibold">{name(reason.playerId)}</span>
                        {result.lineup.captainId === reason.playerId ? <Badge tone="accent">C</Badge> : null}
                        {result.lineup.viceCaptainId === reason.playerId ? <Badge>V</Badge> : null}
                        {": "}
                        {reason.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <CompareTable result={result} />

      <p className="text-caption text-[var(--muted)]">
        {tr(
          "AI 결과는 참고용입니다. 선택은 FPL 규칙(선수 구성·포메이션·같은 팀 3명·예산·이적 감점)을 서버가 검사한 것이고, 기대 점수·가격은 추정입니다.",
          "The AI result is for reference. The server checked the choice against FPL rules (squad shape, formation, three per club, budget, transfer cost); expected points and prices are estimates."
        )}
      </p>
    </div>
  );
}
