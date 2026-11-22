"use client";

import type { ReactNode } from "react";
import { useLocale } from "@/components/locale-provider";
import { Badge, fmtMoney, fmtSigned, fmtXp, PlayerTag, type PlayerShown } from "@/components/recommend-parts";
import { chipLabel } from "@/lib/chips";
import type { Locale } from "@/lib/locale";
import { chipReasonText } from "@/lib/recommend-text";
import type { ScenarioType, TransferScenario, TransferSearchResult } from "@/lib/xp/transfer-search";

const TYPE_ORDER: ScenarioType[] = ["roll", "one", "two", "wildcard", "freehit"];
const VISIBLE_PER_TYPE = 3;

type Tr = <T = string>(ko: T, en: T) => T;

export function scenarioTypeLabel(type: ScenarioType, tr: Tr, locale: Locale) {
  if (type === "roll") return tr("넘기기 (이적 없음)", "Roll (no transfer)");
  if (type === "one") return tr("1명 이적", "1 transfer");
  if (type === "two") return tr("2명 이적", "2 transfers");
  return chipLabel(type, false, locale);
}

function PlayerList({ ids, lookup, showCost }: { ids: number[]; lookup: (id: number) => PlayerShown; showCost: boolean }) {
  return (
    <>
      {ids.map((id, index) => (
        <span key={id}>
          {index > 0 ? ", " : null}
          <PlayerTag player={lookup(id)} showCost={showCost} />
        </span>
      ))}
    </>
  );
}

function Figure({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-caption text-[var(--muted)]">{label}</dt>
      <dd className="text-body font-semibold tabular-nums">{children}</dd>
    </div>
  );
}

function ScenarioCard({
  scenario,
  recommended,
  horizon,
  lookup
}: {
  scenario: TransferScenario;
  recommended: boolean;
  horizon: number;
  lookup: (id: number) => PlayerShown;
}) {
  const { tr, locale } = useLocale();
  const isChip = scenario.type === "wildcard" || scenario.type === "freehit";

  const moves =
    scenario.type === "roll" ? (
      <p className="text-meta text-[var(--muted)]">{tr("이번 주는 이적하지 않습니다.", "No transfer this week.")}</p>
    ) : (
      <div className="flex flex-col gap-0.5 text-meta">
        <p>
          <span className="text-[var(--muted)]">{tr("나가는 선수", "Out")}: </span>
          <PlayerList ids={scenario.out} lookup={lookup} showCost={false} />
        </p>
        <p>
          <span className="text-[var(--muted)]">{tr("들어오는 선수", "In")}: </span>
          <PlayerList ids={scenario.in} lookup={lookup} showCost />
        </p>
      </div>
    );

  return (
    <li
      className={`flex min-w-0 flex-col gap-1.5 rounded-md border px-3 py-2 ${recommended ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--border)] bg-[var(--surface)]"}`}
      data-scenario={scenario.id}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-body font-semibold">{scenarioTypeLabel(scenario.type, tr, locale)}</span>
        {recommended ? <Badge tone="accent">{tr("권장", "Recommended")}</Badge> : null}
        {scenario.budgetTight ? <Badge tone="warn">{tr("예산 여유 0.1 이하", "Budget margin 0.1 or less")}</Badge> : null}
        {scenario.sellingPriceEstimated ? <Badge>{tr("판매가 추정", "Selling price est.")}</Badge> : null}
        {scenario.freeTransfersEstimated ? <Badge>{tr("무료 이적 수 추정", "Free transfers est.")}</Badge> : null}
        {isChip && !scenario.optimal ? <Badge>{tr("근사 탐색", "Approximate")}</Badge> : null}
      </div>

      {isChip ? (
        <details className="text-meta">
          <summary className="cursor-pointer text-[var(--muted)]">
            {tr(`교체 ${scenario.in.length}명 보기`, `Show ${scenario.in.length} swaps`)}
          </summary>
          <div className="mt-1">{moves}</div>
        </details>
      ) : (
        moves
      )}

      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-5">
        <Figure label={tr("다음 GW 기대 점수", "Next GW xP")}>{fmtXp(scenario.nextGwXp)}</Figure>
        <Figure label={tr(`기간 합 (${horizon}GW)`, `${horizon}-GW total`)}>{fmtXp(scenario.periodXp)}</Figure>
        <Figure label={tr("이적 비용", "Transfer cost")}>
          {scenario.transferCost === 0 ? "0" : `-${scenario.transferCost}${tr("점", " pts")}`}
        </Figure>
        <Figure label={tr("넘기기 대비 순이익", "Net gain vs roll")}>{scenario.type === "roll" ? "0.0" : fmtSigned(scenario.netGain)}</Figure>
        <Figure label={tr("남는 은행", "Bank left")}>{fmtMoney(scenario.bankAfter)}</Figure>
      </dl>

      {isChip && recommended ? (
        <p role="note" className="text-caption text-[var(--warning)]">
          {tr(
            "칩 사용은 신중히 하세요. 칩은 시즌에 한 번뿐이라, 이 수치만으로 쓸 때인지 정할 수 없습니다.",
            "Use a chip with care. Each chip can be played once, so these figures alone cannot tell you it is the time."
          )}
        </p>
      ) : null}
      {scenario.type === "freehit" ? (
        <p className="text-caption text-[var(--muted)]">
          {tr("프리 힛은 그 주만 바뀌고 다음 주에는 원래 팀으로 돌아옵니다.", "A Free Hit changes only that week; the squad returns to what it was the next week.")}
        </p>
      ) : null}
    </li>
  );
}

export function TransferScenarios({
  result,
  lookup,
  horizon,
  onHorizon
}: {
  result: TransferSearchResult;
  lookup: (id: number) => PlayerShown;
  horizon: 3 | 5;
  onHorizon: (horizon: 3 | 5) => void;
}) {
  const { tr, locale } = useLocale();

  const groups = TYPE_ORDER.map((type) => ({
    type,
    scenarios: result.scenarios.filter((scenario) => scenario.type === type).sort((a, b) => b.netGain - a.netGain)
  })).filter((group) => group.scenarios.length > 0);
  const hasChip = result.scenarios.some((scenario) => scenario.type === "wildcard" || scenario.type === "freehit");

  const card = (scenario: TransferScenario) => (
    <ScenarioCard
      key={scenario.id}
      scenario={scenario}
      recommended={scenario.id === result.recommendedId}
      horizon={result.gws.length}
      lookup={lookup}
    />
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 text-meta text-[var(--muted)]">
          {tr(
            `무료 이적 ${result.freeTransfers}개(추정) · 은행 ${fmtMoney(result.bank)} · 예산 ${fmtMoney(result.budget)}(판매가 합 + 은행, 추정)`,
            `${result.freeTransfers} free transfer(s) (est.) · bank ${fmtMoney(result.bank)} · budget ${fmtMoney(result.budget)} (selling prices + bank, est.)`
          )}
        </p>
        <div role="group" aria-label={tr("계산 기간", "Horizon")} className="inline-flex overflow-hidden rounded-md border border-[var(--border)]">
          {([3, 5] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={horizon === value}
              onClick={() => onHorizon(value)}
              className={`min-h-9 px-3 text-meta font-semibold ${horizon === value ? "bg-[var(--accent)] text-white" : "bg-[var(--surface)]"}`}
            >
              {value}GW
            </button>
          ))}
        </div>
      </div>

      {result.recommendedId === "roll" ? (
        <p className="text-meta">
          {tr(
            `이번 주는 넘기기를 권장합니다. 가장 나은 이적도 순이익이 ${result.params.minNetGain}점에 못 미칩니다.`,
            `Rolling is recommended this week: even the best transfer nets less than ${result.params.minNetGain} points.`
          )}
        </p>
      ) : null}

      {groups.map((group) => {
        const rest = group.scenarios.slice(VISIBLE_PER_TYPE);
        const recommendedInRest = rest.find((scenario) => scenario.id === result.recommendedId);
        const visible = recommendedInRest ? [...group.scenarios.slice(0, VISIBLE_PER_TYPE), recommendedInRest] : group.scenarios.slice(0, VISIBLE_PER_TYPE);
        const hidden = rest.filter((scenario) => scenario !== recommendedInRest);
        return (
          <ul key={group.type} className="flex list-none flex-col gap-1.5 p-0">
            {visible.map(card)}
            {hidden.length > 0 ? (
              <li className="list-none">
                <details>
                  <summary className="cursor-pointer text-meta text-[var(--muted)]">
                    {tr(
                      `${scenarioTypeLabel(group.type, tr, locale)} 나머지 ${hidden.length}개`,
                      `${hidden.length} more: ${scenarioTypeLabel(group.type, tr, locale)}`
                    )}
                  </summary>
                  <ul className="mt-1.5 flex list-none flex-col gap-1.5 p-0">{hidden.map(card)}</ul>
                </details>
              </li>
            ) : null}
          </ul>
        );
      })}

      {result.skipped.length > 0 ? (
        <ul className="flex list-none flex-col gap-0.5 p-0 text-meta text-[var(--muted)]">
          {result.skipped.map((skip) => (
            <li key={skip.type}>
              {tr(`${chipLabel(skip.type, false, locale)} 안 없음: `, `No ${chipLabel(skip.type, false, locale)} option: `)}
              {chipReasonText(skip.reason, locale)}
            </li>
          ))}
        </ul>
      ) : null}

      {hasChip ? (
        <p className="text-caption text-[var(--muted)]">
          {tr(
            "와일드카드·프리 힛 안은 은행을 많이 남기고 비싼 선수를 낮게 평가할 수 있습니다(1차 모델의 한계). 숫자보다 어떤 선수가 들어오는지를 살펴보세요.",
            "Wildcard and Free Hit options can leave a lot of money in the bank and under-rate expensive players (a limit of the first model). Look at who comes in, not only the numbers."
          )}
        </p>
      ) : null}
    </div>
  );
}
