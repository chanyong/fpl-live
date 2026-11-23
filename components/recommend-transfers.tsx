"use client";

import { Fragment, useState, type ReactNode } from "react";
import { useLocale } from "@/components/locale-provider";
import { Badge, fmtMoney, fmtSigned, fmtXp, PlayerTag, type PlayerShown } from "@/components/recommend-parts";
import type { FdrHorizon } from "@/lib/squad-view";
import { ScenarioPitch } from "@/components/scenario-pitch";
import { chipLabel } from "@/lib/chips";
import type { Locale } from "@/lib/locale";
import { chipReasonText } from "@/lib/recommend-text";
import { chipModeNote, chipPickReason, POSITION_ORDER, type ChipExplanation } from "@/lib/xp/chip-explain";
import type { EntryRecommendPayload } from "@/lib/xp/recommend";
import type { ScenarioType, TransferScenario, TransferSearchResult } from "@/lib/xp/transfer-search";

const TYPE_ORDER: ScenarioType[] = ["roll", "one", "two", "wildcard", "freehit"];
/** Runner-ups shown as one-line rows under the best scenario of a group; the rest are folded. */
const VISIBLE_RUNNER_UPS = 2;

type Tr = <T = string>(ko: T, en: T) => T;
type Lookup = (id: number) => PlayerShown;
/** Issue #61: lets a card or row pick the scenario the pitch shows (null when the response has no lineups). */
type Selection = { selectedId: string; onSelect: (id: string) => void; compareId: string | null; onCompare: (id: string | null) => void };

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
          <span aria-hidden className="mx-1 text-[var(--muted)]">
            {"→"}
          </span>
          <span className="sr-only">{tr(" 대신 ", " replaced by ")}</span>
          {pair.in !== null ? <PlayerTag player={lookup(pair.in)} showCost /> : null}
        </li>
      ))}
    </ul>
  );
}

/** Issue #69: why each incoming player of a chip scenario, grouped by position; the wording differs for Free Hit and Wildcard. */
function ChipWhy({ explanation, lookup }: { explanation: ChipExplanation; lookup: Lookup }) {
  const { tr, locale } = useLocale();
  const names = (id: number) => lookup(id).name;
  return (
    <div className="mt-1.5 flex flex-col gap-1" data-chip-why={explanation.mode}>
      <p className="text-caption text-[var(--muted)]">{chipModeNote(explanation.mode, explanation.horizon, locale)}</p>
      {POSITION_ORDER.map((position) => {
        const picks = explanation.picks.filter((pick) => pick.position === position);
        if (picks.length === 0) return null;
        return (
          <div key={position}>
            <p className="text-caption font-semibold">{position}</p>
            <ul className="flex list-none flex-col gap-0.5 p-0">
              {picks.map((pick) => (
                <li key={pick.id} className="min-w-0 break-words text-meta" data-chip-pick={pick.id}>
                  <span className="font-semibold">{names(pick.id)}</span>
                  <span className="text-caption text-[var(--muted)]">{` (${pick.teamShortName} · ${position} · ${fmtMoney(pick.cost)})`}</span>
                  {pick.role === "C" ? <Badge tone="accent">{tr("캡틴 후보", "Captain pick")}</Badge> : null}
                  {pick.role === "V" ? <Badge>{tr("부주장 후보", "Vice pick")}</Badge> : null}
                  <span className="block text-caption text-[var(--muted)]">{chipPickReason(pick, explanation.mode, explanation.horizon, locale, names)}</span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
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

/** "넘기기", "Diop → Hill" ...: the name the pitch heading uses. */
function scenarioTitle(scenario: TransferScenario, lookup: Lookup, tr: Tr, locale: Locale) {
  if (scenario.type === "one" || scenario.type === "two") {
    const pairs = pairSwaps(scenario, lookup).map((pair) => `${lookup(pair.out).name}→${pair.in !== null ? lookup(pair.in).name : "?"}`);
    return pairs.join(", ");
  }
  return scenarioTypeLabel(scenario.type, tr, locale);
}

function ShowOnPitch({ id, onSelect, active }: { id: string; onSelect: (id: string) => void; active: boolean }) {
  const { tr } = useLocale();
  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      aria-pressed={active}
      className={`min-h-8 rounded-md border px-2 text-caption font-semibold ${active ? "border-[var(--accent)] bg-[var(--accent)] text-white" : "border-[var(--border)] bg-[var(--surface)]"}`}
    >
      {tr("피치로 보기", "Show on pitch")}
    </button>
  );
}

/** Issue #78: put this scenario's squad next to the one on the pitch (a second pitch, side by side on wide screens). */
function CompareButton({ id, selection }: { id: string; selection: Selection }) {
  const { tr } = useLocale();
  if (id === selection.selectedId) return null;
  const active = selection.compareId === id;
  return (
    <button
      type="button"
      onClick={() => selection.onCompare(active ? null : id)}
      aria-pressed={active}
      className={`min-h-8 rounded-md border px-2 text-caption font-semibold ${active ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-ink)]" : "border-[var(--border)] bg-[var(--surface)]"}`}
    >
      {tr("열린 안과 비교", "Compare with open")}
    </button>
  );
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

/**
 * The best scenario of a group, in full. The first row puts what changes (left) and the net gain (right, pinned to the top)
 * side by side, so neither leaves an empty line; the figures sit right under the swaps, or beside them on a wide screen.
 * A chip's badges are shown in its group header instead (see TransferScenarios), so its card has no title line.
 */
function ScenarioCard({
  scenario,
  recommended,
  horizon,
  bank,
  lookup,
  selection,
  explanation
}: {
  scenario: TransferScenario;
  recommended: boolean;
  horizon: number;
  bank: number;
  lookup: Lookup;
  selection: Selection | null;
  explanation?: ChipExplanation;
}) {
  const { tr } = useLocale();
  const isChip = isChipType(scenario.type);
  const change = bankChange(scenario, bank);
  const notes = [
    isChip && recommended
      ? tr(
          "칩 사용은 신중히 하세요. 칩은 시즌에 한 번뿐이라, 이 수치만으로 쓸 때인지 정할 수 없습니다.",
          "Use a chip with care. Each chip can be played once, so these figures alone cannot tell you it is the time."
        )
      : null,
    scenario.type === "freehit"
      ? tr("프리 힛은 그 주만 바뀌고 다음 주에는 원래 팀으로 돌아옵니다.", "A Free Hit changes only that week; the squad returns to what it was the next week.")
      : null
  ].filter((note): note is string => note !== null);

  return (
    <li
      className={`flex min-w-0 flex-col gap-1 rounded-md border px-2.5 py-1.5 sm:px-3 ${recommended ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--border)] bg-[var(--surface)]"}`}
      data-scenario={scenario.id}
    >
      <div className="flex items-start justify-between gap-4 xl:gap-6">
        <div className="flex min-w-0 flex-1 flex-col gap-1 xl:flex-row xl:items-start xl:gap-8">
          <div className="flex min-w-0 flex-col gap-1 xl:flex-1">
            {isChip ? null : (
              // empty:hidden: no badge, no row (so the swaps start at the top, level with the net gain)
              <div className="flex flex-wrap items-center gap-1.5 empty:hidden">
                <ScenarioBadges scenario={scenario} recommended={recommended} />
              </div>
            )}
            {scenario.type === "roll" ? (
              <p className="text-meta text-[var(--muted)]">{tr("이번 주는 이적하지 않습니다.", "No transfer this week.")}</p>
            ) : isChip ? (
              <details className="text-meta">
                <summary className="cursor-pointer text-[var(--muted)]">{tr(`교체 ${scenario.in.length}명 보기`, `Show ${scenario.in.length} swaps`)}</summary>
                <div className="mt-1">
                  <Swaps scenario={scenario} lookup={lookup} />
                  {explanation ? <ChipWhy explanation={explanation} lookup={lookup} /> : null}
                </div>
              </details>
            ) : (
              <Swaps scenario={scenario} lookup={lookup} />
            )}
            {selection ? (
              <div className="flex flex-wrap gap-1.5">
                <ShowOnPitch id={scenario.id} onSelect={selection.onSelect} active={selection.selectedId === scenario.id} />
                <CompareButton id={scenario.id} selection={selection} />
              </div>
            ) : null}
          </div>
          <dl className="flex flex-wrap gap-x-4 gap-y-0.5 xl:shrink-0">
            <Figure label={tr("다음 GW 기대 점수", "Next GW xP")}>{fmtXp(scenario.nextGwXp)}</Figure>
            <Figure label={tr(`기간 합 (${horizon}GW)`, `${horizon}-GW total`)}>{fmtXp(scenario.periodXp)}</Figure>
            <Figure label={tr("남는 은행", "Bank left")}>
              {fmtMoney(scenario.bankAfter)}
              {change ? <span className="ml-1 text-caption font-normal text-[var(--muted)]">({change})</span> : null}
            </Figure>
            {scenario.transferCost > 0 ? <Figure label={tr("이적 비용", "Transfer cost")}>{`-${scenario.transferCost}${tr("점", " pts")}`}</Figure> : null}
          </dl>
        </div>
        <div className="flex shrink-0 flex-col items-end whitespace-nowrap sm:flex-row sm:items-baseline sm:gap-1.5 xl:pl-2">
          <span className="order-2 text-caption text-[var(--muted)] sm:order-1">{tr("넘기기 대비 순이익", "Net gain vs roll")}</span>
          <span className="order-1 text-title font-semibold leading-none tabular-nums sm:order-2">{scenario.type === "roll" ? "0.0" : fmtSigned(scenario.netGain)}</span>
        </div>
      </div>

      {notes.length > 0 ? (
        <p role="note" className={`text-caption ${isChip && recommended ? "text-[var(--warning)]" : "text-[var(--muted)]"}`}>
          {notes.join(" ")}
        </p>
      ) : null}
    </li>
  );
}

/** A runner-up in the same group, folded to a short row: who for whom, and the gap to the best one. */
function CompactRow({ scenario, best, recommended, lookup, selection }: { scenario: TransferScenario; best: TransferScenario; recommended: boolean; lookup: Lookup; selection: Selection | null }) {
  const { tr } = useLocale();
  const gap = scenario.netGain - best.netGain;
  return (
    <li className="flex min-w-0 flex-col gap-0.5 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 sm:px-3" data-scenario={scenario.id}>
      <div className="flex items-start justify-between gap-4 xl:gap-6">
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
        {selection ? <ShowOnPitch id={scenario.id} onSelect={selection.onSelect} active={selection.selectedId === scenario.id} /> : null}
        {selection ? <CompareButton id={scenario.id} selection={selection} /> : null}
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
function SummaryTable({ rows, horizon, recommendedId, selectedId, onSelect }: { rows: TransferScenario[]; horizon: number; recommendedId: string; selectedId: string; onSelect: (id: string) => void }) {
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
              <tr
                key={row.id}
                onClick={() => onSelect(row.id)}
                aria-selected={row.id === selectedId}
                data-summary-row={row.id}
                className={`cursor-pointer border-t border-[var(--border)] tabular-nums ${picked ? "bg-[var(--accent-soft)] font-semibold" : ""} ${row.id === selectedId ? "outline outline-2 -outline-offset-2 outline-[var(--accent)]" : ""}`}
              >
                <th scope="row" className="whitespace-nowrap px-1 py-1.5 text-left align-middle text-caption font-semibold sm:text-meta">
                  <button type="button" onClick={() => onSelect(row.id)} aria-pressed={row.id === selectedId} className="text-left font-semibold underline decoration-dotted underline-offset-2">
                    {tr(label[0], label[1])}
                  </button>
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
  onHorizon,
  scenarioLineups,
  lineupPlayers,
  chipExplanations,
  fdrHorizon = 3,
  onFdrHorizon
}: {
  result: TransferSearchResult;
  lookup: Lookup;
  horizon: 3 | 5;
  onHorizon: (horizon: 3 | 5) => void;
  scenarioLineups?: EntryRecommendPayload["scenarioLineups"];
  lineupPlayers?: EntryRecommendPayload["lineupPlayers"];
  chipExplanations?: EntryRecommendPayload["chipExplanations"];
  /** Issue #76: the squad screen's 3/5-game FDR switch, shared with the scenario pitch. */
  fdrHorizon?: FdrHorizon;
  onFdrHorizon?: (next: FdrHorizon) => void;
}) {
  const { tr, locale } = useLocale();
  // Issue #61: the scenario whose XI and bench the pitch shows; the recommended one until the reader picks another.
  const [pickedId, setPickedId] = useState<string | null>(null);
  const selectedId = pickedId && scenarioLineups?.[pickedId] ? pickedId : result.recommendedId;
  const selectedScenario = result.scenarios.find((scenario) => scenario.id === selectedId);
  const selectedLineup = scenarioLineups?.[selectedId];
  const selectedWhy = chipExplanations?.[selectedId];
  const pitchReasons = selectedWhy
    ? Object.fromEntries(selectedWhy.picks.map((pick) => [pick.id, chipPickReason(pick, selectedWhy.mode, selectedWhy.horizon, locale, (id) => lookup(id).name)]))
    : undefined;
  // Issue #78: an optional second scenario drawn beside the open one.
  const [comparePicked, setComparePicked] = useState<string | null>(null);
  const compareId = comparePicked && comparePicked !== selectedId && scenarioLineups?.[comparePicked] ? comparePicked : null;
  const compareScenario = compareId ? result.scenarios.find((scenario) => scenario.id === compareId) : undefined;
  const compareLineup = compareId ? scenarioLineups?.[compareId] : undefined;
  const compareWhy = compareId ? chipExplanations?.[compareId] : undefined;
  const compareReasons = compareWhy
    ? Object.fromEntries(compareWhy.picks.map((pick) => [pick.id, chipPickReason(pick, compareWhy.mode, compareWhy.horizon, locale, (id) => lookup(id).name)]))
    : undefined;
  const selection: Selection | null = scenarioLineups && lineupPlayers ? { selectedId, onSelect: setPickedId, compareId, onCompare: setComparePicked } : null;

  // Issue #78: the pitch opens right under the card that was pressed (a sibling row, full width inside a wide grid).
  const pitchRow = (id: string) => {
    if (id !== selectedId || !selectedLineup || !selectedScenario || !lineupPlayers) return null;
    const showCompare = compareLineup && compareScenario;
    return (
      <li key={`${id}-pitch`} className="list-none lg:col-span-2" data-pitch-slot={id}>
        <div className={`grid min-w-0 gap-3 rounded-md border border-[var(--border)] bg-[var(--surface)] p-2 ${showCompare ? "xl:grid-cols-2" : ""}`} data-compare={showCompare ? "on" : "off"}>
          <ScenarioPitch
            lineup={selectedLineup}
            cards={lineupPlayers}
            isRoll={selectedScenario.type === "roll"}
            label={scenarioTitle(selectedScenario, lookup, tr, locale)}
            reasons={pitchReasons}
            fdrHorizon={fdrHorizon}
            onFdrHorizon={onFdrHorizon}
          />
          {showCompare ? (
            <div className="flex min-w-0 flex-col gap-1.5 border-t border-[var(--border)] pt-3 xl:border-l xl:border-t-0 xl:pl-3 xl:pt-0" data-compare-pane={compareId}>
              <ScenarioPitch
                lineup={compareLineup}
                cards={lineupPlayers}
                isRoll={compareScenario.type === "roll"}
                label={scenarioTitle(compareScenario, lookup, tr, locale)}
                reasons={compareReasons}
                fdrHorizon={fdrHorizon}
              />
              <button type="button" onClick={() => setComparePicked(null)} className="min-h-8 self-start rounded-md border border-[var(--border)] px-2 text-caption font-semibold">
                {tr("비교 닫기", "Close comparison")}
              </button>
            </div>
          ) : (
            <p className="text-caption text-[var(--muted)]">{tr("다른 안의 '열린 안과 비교'를 누르면 두 경우를 나란히 봅니다.", "Press “Compare with open” on another option to see both side by side.")}</p>
          )}
        </div>
      </li>
    );
  };

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
      <Fragment key={scenario.id}>
        <CompactRow scenario={scenario} best={best} recommended={scenario.id === result.recommendedId} lookup={lookup} selection={selection} />
        {pitchRow(scenario.id)}
      </Fragment>
    );
    const isChipGroup = isChipType(group.type);
    const label = scenarioTypeLabel(group.type, tr, locale);
    // 이적 시나리오(h3) 아래 묶음은 h4, 칩 구역(h4) 아래 묶음은 h5
    const Heading = isChipGroup ? "h5" : "h4";
    return (
      <section key={group.type} aria-label={label} className="overflow-hidden rounded-md border border-[var(--border)]" data-group={group.type}>
        <header className="flex flex-wrap items-baseline gap-x-3 gap-y-0 border-l-4 border-[var(--accent)] bg-[var(--accent-soft)] px-3 py-1.5">
          <Heading className="text-title-lg font-bold text-[var(--accent-ink)]">{label}</Heading>
          {group.type === "roll" ? null : (
            <p className="text-meta font-semibold tabular-nums text-[var(--accent-ink)]">
              {tr(
                `최선 ${fmtSigned(best.netGain)}${rest.length > 0 ? ` · 대안 ${rest.length}` : ""}`,
                `best ${fmtSigned(best.netGain)}${rest.length > 0 ? ` · ${rest.length} alt.` : ""}`
              )}
            </p>
          )}
          {isChipGroup ? (
            <span className="flex flex-wrap items-center gap-1.5 self-center">
              <ScenarioBadges scenario={best} recommended={best.id === result.recommendedId} />
            </span>
          ) : null}
        </header>
        <ul className="flex list-none flex-col gap-1 p-1 sm:p-1.5">
          <ScenarioCard
            scenario={best}
            recommended={best.id === result.recommendedId}
            horizon={result.gws.length}
            bank={result.bank}
            lookup={lookup}
            selection={selection}
            explanation={chipExplanations?.[best.id]}
          />
          {pitchRow(best.id)}
          {visible.length > 0 ? (
            <li className="list-none">
              <ul className="grid list-none gap-1 p-0 lg:grid-cols-2">{visible.map(row)}</ul>
            </li>
          ) : null}
          {hidden.length > 0 ? (
            <li className="list-none">
              {/* Issue #78: open the fold when the scenario on the pitch is inside it (e.g. picked from the summary table). */}
              <details open={hidden.some((scenario) => scenario.id === selectedId) || undefined}>
                <summary className="cursor-pointer px-1 text-meta text-[var(--muted)]">
                  {tr(`${label} 나머지 ${hidden.length}개`, `${hidden.length} more: ${label}`)}
                </summary>
                <ul className="mt-1 grid list-none gap-1 p-0 lg:grid-cols-2">{hidden.map(row)}</ul>
              </details>
            </li>
          ) : null}
        </ul>
      </section>
    );
  };

  return (
    <div className="flex flex-col gap-1.5">
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

      <SummaryTable
        rows={groups.map((group) => group.scenarios[0])}
        horizon={result.gws.length}
        recommendedId={result.recommendedId}
        selectedId={selectedId}
        onSelect={setPickedId}
      />

      {moveGroups.map(renderGroup)}

      {chipGroups.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <h4 className="border-b-2 border-[var(--accent)] pb-0.5 text-title-lg font-bold">{tr("칩 (시즌에 한 번뿐)", "Chips (once per season)")}</h4>
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
