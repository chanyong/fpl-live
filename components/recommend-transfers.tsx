"use client";

import type { ReactNode } from "react";
import { useLocale } from "@/components/locale-provider";
import { Badge, fmtMoney, fmtSigned, fmtXp, PlayerTag, type PlayerShown } from "@/components/recommend-parts";
import { chipLabel } from "@/lib/chips";
import type { Locale } from "@/lib/locale";
import { chipReasonText } from "@/lib/recommend-text";
import type { ScenarioType, TransferScenario, TransferSearchResult } from "@/lib/xp/transfer-search";

const TYPE_ORDER: ScenarioType[] = ["roll", "one", "two", "wildcard", "freehit"];
/** Runner-ups shown as one-line rows under the best scenario of a group; the rest are folded. */
const VISIBLE_RUNNER_UPS = 2;

type Tr = <T = string>(ko: T, en: T) => T;
type Lookup = (id: number) => PlayerShown;

export function scenarioTypeLabel(type: ScenarioType, tr: Tr, locale: Locale) {
  if (type === "roll") return tr("넘기기 (이적 없음)", "Roll (no transfer)");
  if (type === "one") return tr("1명 이적", "1 transfer");
  if (type === "two") return tr("2명 이적", "2 transfers");
  return chipLabel(type, false, locale);
}

const isChipType = (type: ScenarioType) => type === "wildcard" || type === "freehit";

type Pair = { out: number; in: number | null };

/** Pairs each outgoing player with an incoming one of the same position when it can (the search does not say who replaces whom). */
function pairSwaps(scenario: TransferScenario, lookup: Lookup): Pair[] {
  const free = [...scenario.in];
  return scenario.out.map((out) => {
    const position = lookup(out).position;
    let at = free.findIndex((id) => position !== null && lookup(id).position === position);
    if (at < 0) at = 0;
    const picked = free.length > 0 ? free.splice(at, 1)[0] : null;
    return { out, in: picked };
  });
}

function Swaps({ scenario, lookup }: { scenario: TransferScenario; lookup: Lookup }) {
  const { tr } = useLocale();
  return (
    <ul className="flex list-none flex-col gap-0.5 p-0">
      {pairSwaps(scenario, lookup).map((pair) => (
        <li key={pair.out} className="min-w-0 break-words text-meta">
          <PlayerTag player={lookup(pair.out)} />
          <span aria-label={tr("에서", "to")} className="mx-1 text-[var(--muted)]">
            {"→"}
          </span>
          {pair.in !== null ? <PlayerTag player={lookup(pair.in)} showCost /> : null}
        </li>
      ))}
    </ul>
  );
}

function Figure({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-caption text-[var(--muted)]">{label}</dt>
      <dd className="text-meta font-semibold tabular-nums">{children}</dd>
    </div>
  );
}

function bankChange(scenario: TransferScenario, bank: number) {
  const diff = scenario.bankAfter - bank;
  if (diff === 0) return null;
  return `${diff > 0 ? "+" : "-"}${fmtMoney(Math.abs(diff))}`;
}

function ScenarioBadges({ scenario, recommended }: { scenario: TransferScenario; recommended: boolean }) {
  const { tr } = useLocale();
  return (
    <>
      {recommended ? <Badge tone="accent">{tr("권장", "Recommended")}</Badge> : null}
      {scenario.budgetTight ? <Badge tone="warn">{tr("예산 여유 0.1 이하", "Budget margin 0.1 or less")}</Badge> : null}
      {scenario.sellingPriceEstimated ? <Badge>{tr("판매가 추정", "Selling price est.")}</Badge> : null}
      {scenario.freeTransfersEstimated ? <Badge>{tr("무료 이적 수 추정", "Free transfers est.")}</Badge> : null}
      {isChipType(scenario.type) && !scenario.optimal ? <Badge>{tr("근사 탐색", "Approximate")}</Badge> : null}
    </>
  );
}

/** The best scenario of a group, in full: the net gain is the big figure, the rest are small. */
function ScenarioCard({
  scenario,
  recommended,
  horizon,
  bank,
  lookup
}: {
  scenario: TransferScenario;
  recommended: boolean;
  horizon: number;
  bank: number;
  lookup: Lookup;
}) {
  const { tr, locale } = useLocale();
  const isChip = isChipType(scenario.type);
  const change = bankChange(scenario, bank);

  return (
    <li
      className={`flex min-w-0 flex-col gap-1.5 rounded-md border px-3 py-2 ${recommended ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--border)] bg-[var(--surface)]"}`}
      data-scenario={scenario.id}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className="text-body font-semibold">{scenarioTypeLabel(scenario.type, tr, locale)}</span>
          <ScenarioBadges scenario={scenario} recommended={recommended} />
        </div>
        <div className="shrink-0 text-right">
          <div className="text-title font-semibold leading-none tabular-nums">{scenario.type === "roll" ? "0.0" : fmtSigned(scenario.netGain)}</div>
          <div className="text-caption text-[var(--muted)]">{tr("넘기기 대비 순이익", "Net gain vs roll")}</div>
        </div>
      </div>

      {scenario.type === "roll" ? (
        <p className="text-meta text-[var(--muted)]">{tr("이번 주는 이적하지 않습니다.", "No transfer this week.")}</p>
      ) : isChip ? (
        <details className="text-meta">
          <summary className="cursor-pointer text-[var(--muted)]">{tr(`교체 ${scenario.in.length}명 보기`, `Show ${scenario.in.length} swaps`)}</summary>
          <div className="mt-1">
            <Swaps scenario={scenario} lookup={lookup} />
          </div>
        </details>
      ) : (
        <Swaps scenario={scenario} lookup={lookup} />
      )}

      <dl className="flex flex-wrap gap-x-4 gap-y-1 border-t border-[var(--border)] pt-1.5">
        <Figure label={tr("다음 GW 기대 점수", "Next GW xP")}>{fmtXp(scenario.nextGwXp)}</Figure>
        <Figure label={tr(`기간 합 (${horizon}GW)`, `${horizon}-GW total`)}>{fmtXp(scenario.periodXp)}</Figure>
        <Figure label={tr("남는 은행", "Bank left")}>
          {fmtMoney(scenario.bankAfter)}
          {change ? <span className="ml-1 text-caption font-normal text-[var(--muted)]">({change})</span> : null}
        </Figure>
        {scenario.transferCost > 0 ? <Figure label={tr("이적 비용", "Transfer cost")}>{`-${scenario.transferCost}${tr("점", " pts")}`}</Figure> : null}
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

/** A runner-up in the same group, folded to a short row: who for whom, and the gap to the best one. */
function CompactRow({ scenario, best, recommended, lookup }: { scenario: TransferScenario; best: TransferScenario; recommended: boolean; lookup: Lookup }) {
  const { tr } = useLocale();
  const gap = scenario.netGain - best.netGain;
  return (
    <li className="flex min-w-0 flex-col gap-0.5 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5" data-scenario={scenario.id}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Swaps scenario={scenario} lookup={lookup} />
        </div>
        <div className="shrink-0 text-right text-meta tabular-nums">
          <span className="font-semibold">{fmtSigned(scenario.netGain)}</span>
          <span className="block text-caption text-[var(--muted)]">{tr(`최선 대비 ${fmtSigned(gap)}`, `${fmtSigned(gap)} vs best`)}</span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 text-caption text-[var(--muted)]">
        <span className="tabular-nums">
          {tr(`기간 합 ${fmtXp(scenario.periodXp)} · 남는 은행 ${fmtMoney(scenario.bankAfter)}`, `total ${fmtXp(scenario.periodXp)} · bank left ${fmtMoney(scenario.bankAfter)}`)}
          {scenario.transferCost > 0 ? tr(` · 이적 비용 -${scenario.transferCost}점`, ` · cost -${scenario.transferCost} pts`) : ""}
        </span>
        <ScenarioBadges scenario={scenario} recommended={recommended} />
      </div>
    </li>
  );
}

const SUMMARY_LABEL: Record<ScenarioType, [string, string]> = {
  roll: ["넘기기", "Roll"],
  one: ["1명 최선", "Best 1"],
  two: ["2명 최선", "Best 2"],
  wildcard: ["와일드카드", "Wildcard"],
  freehit: ["프리 힛", "Free Hit"]
};

/** One screen to compare the options: a row per kind (its best scenario), the net gain drawn as a bar. */
function SummaryTable({ rows, horizon, recommendedId }: { rows: TransferScenario[]; horizon: number; recommendedId: string }) {
  const { tr } = useLocale();
  const maxGain = Math.max(0.1, ...rows.map((row) => row.netGain));
  const showCost = rows.some((row) => row.transferCost > 0);
  const head = "whitespace-nowrap px-0.5 py-1 text-caption font-normal text-[var(--muted)] sm:px-1";
  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5" data-summary>
      <table className="w-full table-fixed border-collapse text-meta">
        <caption className="sr-only">{tr("이적 안 비교 요약", "Summary of the transfer options")}</caption>
        <colgroup>
          <col style={{ width: "25%" }} />
          <col />
          <col style={{ width: "12%" }} />
          <col style={{ width: "13%" }} />
          <col style={{ width: "17%" }} />
          {showCost ? <col style={{ width: "11%" }} /> : null}
        </colgroup>
        <thead>
          <tr>
            <th scope="col" className={`${head} text-left`}>{tr("안", "Option")}</th>
            <th scope="col" className={`${head} text-left`}>{tr("순이익", "Net gain")}</th>
            <th scope="col" className={`${head} text-right`}>{tr("다음", "Next")}</th>
            <th scope="col" className={`${head} text-right`}>{tr(`${horizon}GW`, `${horizon}GW`)}</th>
            <th scope="col" className={`${head} text-right`}>{tr("은행", "Bank")}</th>
            {showCost ? <th scope="col" className={`${head} text-right`}>{tr("비용", "Cost")}</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const picked = row.id === recommendedId;
            const label = SUMMARY_LABEL[row.type];
            const width = row.type === "roll" ? 0 : Math.max(0, (row.netGain / maxGain) * 100);
            return (
              <tr key={row.id} className={`border-t border-[var(--border)] tabular-nums ${picked ? "bg-[var(--accent-soft)] font-semibold" : ""}`}>
                <th scope="row" className="whitespace-nowrap px-1 py-1.5 text-left align-middle text-caption font-semibold sm:text-meta">
                  {tr(label[0], label[1])}
                  {picked ? <span className="block text-caption text-[var(--accent-ink)]">{tr("★ 권장", "★ Pick")}</span> : null}
                </th>
                <td className="px-1 py-1.5 align-middle">
                  <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-1.5">
                    <span className="whitespace-nowrap sm:w-10 sm:shrink-0 sm:text-right">{row.type === "roll" ? "0.0" : fmtSigned(row.netGain)}</span>
                    <span aria-hidden className="block h-2 min-w-0 flex-1 rounded-sm bg-[var(--surface-strong)]">
                      <span className="block h-2 rounded-sm bg-[var(--accent)]" style={{ width: `${width}%` }} />
                    </span>
                  </div>
                </td>
                <td className="whitespace-nowrap px-0.5 py-1.5 text-right align-middle text-caption sm:px-1 sm:text-meta">{fmtXp(row.nextGwXp)}</td>
                <td className="whitespace-nowrap px-0.5 py-1.5 text-right align-middle text-caption sm:px-1 sm:text-meta">{fmtXp(row.periodXp)}</td>
                <td className="whitespace-nowrap px-0.5 py-1.5 text-right align-middle text-caption sm:px-1 sm:text-meta">{fmtMoney(row.bankAfter)}</td>
                {showCost ? <td className="whitespace-nowrap px-0.5 py-1.5 text-right align-middle text-caption sm:px-1 sm:text-meta">{row.transferCost > 0 ? `-${row.transferCost}` : "0"}</td> : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function TransferScenarios({
  result,
  lookup,
  horizon,
  onHorizon
}: {
  result: TransferSearchResult;
  lookup: Lookup;
  horizon: 3 | 5;
  onHorizon: (horizon: 3 | 5) => void;
}) {
  const { tr, locale } = useLocale();

  const groups = TYPE_ORDER.map((type) => ({
    type,
    scenarios: result.scenarios.filter((scenario) => scenario.type === type).sort((a, b) => b.netGain - a.netGain)
  })).filter((group) => group.scenarios.length > 0);
  const hasChip = result.scenarios.some((scenario) => isChipType(scenario.type));
  const moveGroups = groups.filter((group) => !isChipType(group.type));
  const chipGroups = groups.filter((group) => isChipType(group.type));

  const renderGroup = (group: (typeof groups)[number]) => {
    const [best, ...rest] = group.scenarios;
    const recommendedInRest = rest.find((scenario) => scenario.id === result.recommendedId);
    const shown = rest.slice(0, VISIBLE_RUNNER_UPS);
    const visible = recommendedInRest && !shown.includes(recommendedInRest) ? [...shown, recommendedInRest] : shown;
    const hidden = rest.filter((scenario) => !visible.includes(scenario));
    const row = (scenario: TransferScenario) => (
      <CompactRow key={scenario.id} scenario={scenario} best={best} recommended={scenario.id === result.recommendedId} lookup={lookup} />
    );
    return (
      <ul key={group.type} className="flex list-none flex-col gap-1.5 p-0">
        <ScenarioCard
          scenario={best}
          recommended={best.id === result.recommendedId}
          horizon={result.gws.length}
          bank={result.bank}
          lookup={lookup}
        />
        {visible.map(row)}
        {hidden.length > 0 ? (
          <li className="list-none">
            <details>
              <summary className="cursor-pointer text-meta text-[var(--muted)]">
                {tr(
                  `${scenarioTypeLabel(group.type, tr, locale)} 나머지 ${hidden.length}개`,
                  `${hidden.length} more: ${scenarioTypeLabel(group.type, tr, locale)}`
                )}
              </summary>
              <ul className="mt-1.5 flex list-none flex-col gap-1.5 p-0">{hidden.map(row)}</ul>
            </details>
          </li>
        ) : null}
      </ul>
    );
  };

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

      <SummaryTable rows={groups.map((group) => group.scenarios[0])} horizon={result.gws.length} recommendedId={result.recommendedId} />

      {moveGroups.map(renderGroup)}

      {chipGroups.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <h4 className="mt-1 text-body font-semibold">{tr("칩 (시즌에 한 번뿐)", "Chips (once per season)")}</h4>
          {chipGroups.map(renderGroup)}
        </div>
      ) : null}

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
