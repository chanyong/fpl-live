"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useLocale } from "@/components/locale-provider";
import { Badge, fmtSigned, fmtTime, fmtXp, SubHeading } from "@/components/recommend-parts";
import { scenarioTypeLabel } from "@/components/recommend-transfers";
import type { AiBasis } from "@/lib/ai/input-bundle";
import type { DonePayload, LimitReason } from "@/lib/ai/recommend";
import type { Locale } from "@/lib/locale";
import { limitText } from "@/lib/recommend-text";
import type { TransferScenario } from "@/lib/xp/transfer-search";

/**
 * AI opinion beside the rules-based result on /team/[id] (issue #43, stage 4).
 *
 * - The screen only READS the status when it opens (GET). A paid call starts only when a person presses a button
 *   (POST); nothing here posts by itself.
 * - Off or not allowed: nothing is drawn at all (the rules-based panel stands alone).
 * - Every figure (expected points, captain weight, net gain, bank) is the server's rules-based value from the
 *   stored `basis`; the model's sentences are drawn as plain text (never as HTML, never as links).
 */

export const POLL_INTERVAL_MS = 5_000;
export const POLL_GIVE_UP_MS = 20 * 60_000;

type AiBody =
  | { status: "none" | "disabled" | "not_allowed" }
  | ({ status: "done" } & DonePayload)
  | { status: "pending"; previous?: DonePayload | null }
  | { status: "limit"; reason: LimitReason; previous?: DonePayload | null }
  | { status: "failed"; code?: string };

type View =
  | { phase: "loading" }
  | { phase: "hidden" }
  | { phase: "none" }
  | { phase: "pending"; shown: DonePayload | null }
  | { phase: "timeout"; shown: DonePayload | null }
  | { phase: "done"; shown: DonePayload }
  | { phase: "failed"; shown: DonePayload | null }
  | { phase: "limit"; reason: LimitReason; shown: DonePayload | null };

const KNOWN_STATUS = new Set(["none", "disabled", "not_allowed", "done", "pending", "limit", "failed"]);

function isBody(value: unknown): value is AiBody {
  return typeof value === "object" && value !== null && KNOWN_STATUS.has((value as { status?: unknown }).status as string);
}

async function readStatus(entryId: number, locale: Locale): Promise<AiBody | null> {
  try {
    const response = await fetch(`/api/entry-ai?entryId=${entryId}&locale=${locale}`);
    if (response.status !== 200 && response.status !== 202) return null;
    const body: unknown = await response.json();
    return isBody(body) ? body : null;
  } catch {
    return null;
  }
}

async function postAnalyse(entryId: number, locale: Locale, regenerate: boolean): Promise<{ ok: true; body: AiBody } | { ok: false; status: number }> {
  try {
    const response = await fetch("/api/entry-ai", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ entryId, locale, regenerate })
    });
    if (response.status !== 200 && response.status !== 202) return { ok: false, status: response.status };
    const body: unknown = await response.json();
    return isBody(body) ? { ok: true, body } : { ok: false, status: 0 };
  } catch {
    return { ok: false, status: 0 };
  }
}

function toView(body: AiBody, keep: DonePayload | null): View {
  switch (body.status) {
    case "none":
      return { phase: "none" };
    case "disabled":
    case "not_allowed":
      return { phase: "hidden" };
    case "done":
      return { phase: "done", shown: body };
    case "pending":
      return { phase: "pending", shown: body.previous ?? keep };
    case "limit":
      return { phase: "limit", reason: body.reason, shown: body.previous ?? keep };
    default:
      return { phase: "failed", shown: keep };
  }
}

const shownOf = (view: View): DonePayload | null => ("shown" in view ? view.shown : null);

// ---------------------------------------------------------------------------------------------------------------
// The stored basis: what the server computed when the analysis was made. Read defensively (it is JSON from a store).

type Basis = {
  captains: AiBasis["captains"];
  lineups: AiBasis["lineups"];
  scenarios: TransferScenario[];
  recommendedId: string | null;
  playerIndex: AiBasis["playerIndex"];
};

function readBasis(raw: unknown): Basis {
  const basis = (typeof raw === "object" && raw !== null ? raw : {}) as Partial<AiBasis>;
  return {
    captains: Array.isArray(basis.captains) ? basis.captains : [],
    lineups: Array.isArray(basis.lineups) ? basis.lineups : [],
    scenarios: Array.isArray(basis.transfers?.scenarios) ? basis.transfers.scenarios : [],
    recommendedId: basis.transfers?.recommendedId ?? null,
    playerIndex: typeof basis.playerIndex === "object" && basis.playerIndex !== null ? basis.playerIndex : {}
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Result

type Tr = <T = string>(ko: T, en: T) => T;

function ScenarioFigures({ scenario, tr }: { scenario: TransferScenario; tr: Tr }) {
  return (
    <span className="tabular-nums">
      {scenario.type === "roll"
        ? tr("순이익 0.0", "net 0.0")
        : tr(
            `순이익 ${fmtSigned(scenario.netGain)} · 다음 GW ${fmtXp(scenario.nextGwXp)} · 기간 합 ${fmtXp(scenario.periodXp)}`,
            `net ${fmtSigned(scenario.netGain)} · next GW ${fmtXp(scenario.nextGwXp)} · total ${fmtXp(scenario.periodXp)}`
          )}
    </span>
  );
}

function SideBySide({ title, numericLabel, aiLabel, rows }: { title: string; numericLabel: string; aiLabel: string; rows: Array<{ key: string; numeric: ReactNode; ai: ReactNode }> }) {
  return (
    <div className="flex flex-col gap-1.5">
      <SubHeading>{title}</SubHeading>
      <div className="hidden grid-cols-2 gap-2 text-caption font-semibold text-[var(--muted)] md:grid">
        <span>{numericLabel}</span>
        <span>{aiLabel}</span>
      </div>
      <ul className="flex list-none flex-col gap-1.5 p-0">
        {rows.map((row) => (
          <li key={row.key} className="grid min-w-0 gap-2 md:grid-cols-2">
            <div className="min-w-0 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-meta">
              <p className="text-caption font-semibold text-[var(--muted)] md:hidden">{numericLabel}</p>
              {row.numeric}
            </div>
            <div className="min-w-0 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-meta">
              <p className="text-caption font-semibold text-[var(--muted)] md:hidden">{aiLabel}</p>
              {row.ai}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AiResultView({ done }: { done: DonePayload }) {
  const { tr, locale } = useLocale();
  const basis = readBasis(done.basis);
  const result = done.result;
  const name = (id: number) => basis.playerIndex[String(id)]?.name ?? `#${id}`;
  const scenarioById = new Map(basis.scenarios.map((scenario) => [scenario.id, scenario]));

  const scenarioName = (scenario: TransferScenario) => {
    const label = scenarioTypeLabel(scenario.type, tr, locale);
    if (scenario.type === "roll") return label;
    if (scenario.type === "wildcard" || scenario.type === "freehit") {
      return `${label} (${tr(`교체 ${scenario.in.length}명`, `${scenario.in.length} swaps`)})`;
    }
    return `${label}: ${scenario.out.map(name).join(", ")} → ${scenario.in.map(name).join(", ")}`;
  };

  // Rules-based order of the transfer scenarios: the recommended one first, then by net gain.
  const numericScenarios = [...basis.scenarios].sort((a, b) => {
    if (a.id === basis.recommendedId) return -1;
    if (b.id === basis.recommendedId) return 1;
    return b.netGain - a.netGain;
  });
  const transferRows = Math.min(numericScenarios.length || result.transfers.length, Math.max(3, result.transfers.length));

  const captainRows = Math.min(3, Math.max(basis.captains.length, result.captain.length));
  const lineup = basis.lineups.find((item) => `L${item.rank}` === result.lineup.option_id);
  const confidence = { low: tr("낮음", "low"), medium: tr("보통", "medium"), high: tr("높음", "high") };
  const topicLabel = { captain: tr("캡틴", "Captain"), lineup: tr("선발", "Lineup"), transfer: tr("이적", "Transfer") };

  const none = tr("해당 없음", "n/a");

  return (
    <div className="flex flex-col gap-3">
      <p className="text-caption text-[var(--muted)]">
        {tr(
          `Claude Fable 5.2 분석 · 분석 시각 ${fmtTime(done.completedAt, locale)} · GW${done.targetGw} 대상`,
          `Analysis by Claude Fable 5.2 · analysed ${fmtTime(done.completedAt, locale)} · for GW${done.targetGw}`
        )}
      </p>

      <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
        <SubHeading>{tr("요약", "Summary")}</SubHeading>
        <p className="mt-1 break-words text-body">{result.summary}</p>
      </div>

      <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
        <SubHeading>{tr("선발 선택 이유", "Why this lineup")}</SubHeading>
        <p className="mt-1 text-meta font-semibold">
          {lineup
            ? tr(
                `${result.lineup.option_id} 선택 · 포메이션 ${lineup.formation} · 기대 점수 ${fmtXp(lineup.expectedPoints)}`,
                `Chose ${result.lineup.option_id} · formation ${lineup.formation} · xP ${fmtXp(lineup.expectedPoints)}`
              )
            : tr(`${result.lineup.option_id} 선택`, `Chose ${result.lineup.option_id}`)}
        </p>
        <p className="mt-1 break-words text-body">{result.lineup.reason}</p>
      </div>

      <SideBySide
        title={tr("캡틴: 수치 기준과 AI 순위", "Captain: numbers and AI ranking")}
        numericLabel={tr("수치 기준 순위", "Rules-based ranking")}
        aiLabel={tr("AI 순위", "AI ranking")}
        rows={Array.from({ length: captainRows }, (_, index) => {
          const numeric = basis.captains[index];
          const ai = result.captain[index];
          const aiNumbers = ai ? basis.captains.find((captain) => captain.id === ai.player_id) : undefined;
          return {
            key: `c${index}`,
            numeric: numeric ? (
              <>
                <p className="font-semibold">{`${index + 1}. ${name(numeric.id)}`}</p>
                <p className="text-caption tabular-nums text-[var(--muted)]">
                  {tr(`기대 점수 ${fmtXp(numeric.xp)} · 추천 비중 ${numeric.weightPct}%`, `xP ${fmtXp(numeric.xp)} · weight ${numeric.weightPct}%`)}
                </p>
              </>
            ) : (
              <p className="text-[var(--muted)]">{none}</p>
            ),
            ai: ai ? (
              <>
                <p className="flex flex-wrap items-center gap-1.5 font-semibold">
                  <span>{`${ai.rank}. ${name(ai.player_id)}`}</span>
                  {numeric && numeric.id !== ai.player_id ? <Badge tone="warn">{tr("수치 기준과 다름", "Differs from numbers")}</Badge> : null}
                </p>
                {aiNumbers ? (
                  <p className="text-caption tabular-nums text-[var(--muted)]">
                    {tr(`기대 점수 ${fmtXp(aiNumbers.xp)} · 추천 비중 ${aiNumbers.weightPct}%`, `xP ${fmtXp(aiNumbers.xp)} · weight ${aiNumbers.weightPct}%`)}
                  </p>
                ) : null}
                <p className="mt-1 break-words">{ai.reason}</p>
                <p className="mt-1 break-words text-[var(--muted)]">{tr("위험", "Risk")}: {ai.risk}</p>
              </>
            ) : (
              <p className="text-[var(--muted)]">{none}</p>
            )
          };
        })}
      />

      {transferRows > 0 ? (
        <SideBySide
          title={tr("이적: 수치 기준과 AI 우선순위", "Transfers: numbers and AI priority")}
          numericLabel={tr("수치 기준 순위", "Rules-based ranking")}
          aiLabel={tr("AI 우선순위", "AI priority")}
          rows={Array.from({ length: transferRows }, (_, index) => {
            const numeric = numericScenarios[index];
            const ai = result.transfers[index];
            const aiScenario = ai ? scenarioById.get(ai.scenario_id) : undefined;
            return {
              key: `t${index}`,
              numeric: numeric ? (
                <>
                  <p className="font-semibold">
                    {`${index + 1}. ${scenarioName(numeric)}`}
                    {numeric.id === basis.recommendedId ? ` (${tr("수치 기준 권장", "rules-based pick")})` : ""}
                  </p>
                  <p className="text-caption text-[var(--muted)]">
                    <ScenarioFigures scenario={numeric} tr={tr} />
                  </p>
                </>
              ) : (
                <p className="text-[var(--muted)]">{none}</p>
              ),
              ai: ai ? (
                <>
                  <p className="flex flex-wrap items-center gap-1.5 font-semibold">
                    <span>{`${ai.priority}. ${aiScenario ? scenarioName(aiScenario) : ai.scenario_id}`}</span>
                    {numeric && numeric.id !== ai.scenario_id ? <Badge tone="warn">{tr("수치 기준과 다름", "Differs from numbers")}</Badge> : null}
                  </p>
                  {aiScenario ? (
                    <p className="text-caption text-[var(--muted)]">
                      <ScenarioFigures scenario={aiScenario} tr={tr} />
                    </p>
                  ) : null}
                  <p className="mt-1 break-words">{ai.reason}</p>
                  <p className="mt-1 break-words text-[var(--muted)]">{tr("위험", "Risk")}: {ai.risk}</p>
                  <p className="mt-1 text-caption text-[var(--muted)]">{tr(`신뢰도 ${confidence[ai.confidence]}`, `Confidence ${confidence[ai.confidence]}`)}</p>
                </>
              ) : (
                <p className="text-[var(--muted)]">{none}</p>
              )
            };
          })}
        />
      ) : null}

      {result.chip_note ? (
        <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
          <SubHeading>{tr("칩 메모", "Chip note")}</SubHeading>
          <p className="mt-1 break-words text-body">{result.chip_note}</p>
        </div>
      ) : null}

      {result.watch_list.length > 0 ? (
        <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
          <SubHeading>{tr("지켜볼 선수", "Players to watch")}</SubHeading>
          <ul className="mt-1 flex list-none flex-col gap-1 p-0 text-meta">
            {result.watch_list.map((item) => (
              <li key={item.player_id} className="break-words">
                <span className="font-semibold">{name(item.player_id)}</span>: {item.note}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {result.disagreements.length > 0 ? (
        <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
          <SubHeading>{tr("수치 기준과 다르게 본 점", "Where the AI differs from the numbers")}</SubHeading>
          <ul className="mt-1 flex list-none flex-col gap-1 p-0 text-meta">
            {result.disagreements.map((item, index) => (
              <li key={index} className="break-words">
                <span className="font-semibold">{topicLabel[item.topic]}</span>: {item.note}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Panel

export function AiOpinionPanel({ entryId }: { entryId: number }) {
  const { tr, locale } = useLocale();
  const [view, setView] = useState<View>({ phase: "loading" });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Opening the screen reads the status only. It never starts a paid call.
  useEffect(() => {
    let cancelled = false;
    setView({ phase: "loading" });
    setNotice(null);
    void readStatus(entryId, locale).then((body) => {
      if (!cancelled) setView(body ? toView(body, null) : { phase: "hidden" });
    });
    return () => {
      cancelled = true;
    };
  }, [entryId, locale]);

  // A running analysis is polled every 5 seconds, for 20 minutes at most, and not while the tab is hidden.
  const polling = view.phase === "pending";
  useEffect(() => {
    if (!polling) return;
    const startedAt = Date.now();
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let inFlight = false;

    const schedule = () => {
      if (stopped || timer !== null || inFlight) return;
      if (Date.now() - startedAt >= POLL_GIVE_UP_MS) {
        setView((current) => (current.phase === "pending" ? { phase: "timeout", shown: current.shown } : current));
        return;
      }
      if (document.visibilityState === "hidden") return;
      timer = setTimeout(poll, POLL_INTERVAL_MS);
    };

    const poll = async () => {
      timer = null;
      inFlight = true;
      const body = await readStatus(entryId, locale);
      inFlight = false;
      if (stopped) return;
      if (body && body.status === "pending") {
        setView((current) => (current.phase === "pending" ? { phase: "pending", shown: body.previous ?? current.shown } : current));
        schedule();
      } else if (body) {
        setView((current) => toView(body, shownOf(current)));
      } else {
        // The status could not be read: keep waiting until the limit instead of dropping a running analysis.
        schedule();
      }
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") schedule();
    };
    document.addEventListener("visibilitychange", onVisible);
    schedule();

    return () => {
      stopped = true;
      if (timer !== null) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [polling, entryId, locale]);

  async function analyse(regenerate: boolean) {
    setBusy(true);
    setNotice(null);
    const kept = shownOf(view);
    const outcome = await postAnalyse(entryId, locale, regenerate);
    setBusy(false);
    if (!outcome.ok) {
      setNotice(
        outcome.status === 429
          ? tr("요청이 많아 잠시 막혔습니다. 잠시 뒤 다시 눌러 주세요.", "Too many requests. Press again shortly.")
          : tr("AI 분석을 요청하지 못했습니다. 잠시 뒤 다시 시도해 주세요.", "Could not ask for the AI analysis. Try again in a moment.")
      );
      return;
    }
    setView(toView(outcome.body, kept));
  }

  if (view.phase === "loading" || view.phase === "hidden") {
    return null;
  }

  const shown = shownOf(view);
  const buttonClass = "min-h-10 rounded-md border border-[var(--border)] bg-[var(--surface-strong)] px-4 text-body font-semibold disabled:opacity-60";

  return (
    <section aria-label={tr("AI 의견", "AI opinion")} className="flex flex-col gap-2 border-t border-[var(--border)] pt-3">
      <h2 className="text-title font-semibold">{tr("AI 의견 (참고용)", "AI opinion (for reference)")}</h2>

      {view.phase === "none" ? (
        <div className="flex flex-col items-start gap-1.5">
          <p className="text-meta text-[var(--muted)]">
            {tr(
              "위의 수치 기준 후보를 AI가 비교해 순위와 이유를 설명합니다. 버튼을 누를 때만 유료 AI를 호출하며 하루·월 한도가 있습니다.",
              "The AI compares the rules-based candidates above and explains a ranking. A paid AI call is made only when you press the button, within daily and monthly limits."
            )}
          </p>
          <button type="button" disabled={busy} onClick={() => void analyse(false)} className={buttonClass}>
            {busy ? tr("요청하는 중…", "Requesting…") : tr("AI 분석", "AI analysis")}
          </button>
        </div>
      ) : null}

      {view.phase === "pending" ? (
        <div role="status" className="flex flex-col gap-1 rounded-md border border-[var(--info-border)] bg-[var(--info-soft)] px-3 py-2 text-meta">
          <p className="animate-pulse font-semibold">{tr("AI가 분석하는 중입니다…", "The AI is analysing…")}</p>
          <p className="text-caption text-[var(--muted)]">
            {tr(
              "몇 분 걸릴 수 있습니다. 이 화면은 5초마다 상태를 확인합니다.",
              "This can take a few minutes. The screen checks the status every 5 seconds."
            )}
          </p>
          {shown ? <p className="text-caption text-[var(--muted)]">{tr("아래는 이전 분석입니다.", "Below is the previous analysis.")}</p> : null}
        </div>
      ) : null}

      {view.phase === "timeout" ? (
        <p role="status" className="rounded-md border border-[var(--border)] px-3 py-2 text-meta">
          {tr(
            "분석이 오래 걸리고 있습니다. 잠시 뒤 이 화면을 새로고침해 주세요.",
            "The analysis is taking long. Reload this page in a little while."
          )}
        </p>
      ) : null}

      {view.phase === "failed" ? (
        <div role="alert" className="flex flex-col items-start gap-1.5 rounded-md border border-[var(--border)] px-3 py-2">
          <p className="text-body">{tr("AI 분석을 만들지 못했습니다. 수치 기준 결과를 참고하세요.", "The AI analysis could not be made. Use the rules-based result above.")}</p>
          <button type="button" disabled={busy} onClick={() => void analyse(shown !== null)} className={buttonClass}>
            {busy ? tr("요청하는 중…", "Requesting…") : tr("다시 시도", "Try again")}
          </button>
        </div>
      ) : null}

      {view.phase === "limit" ? (
        <p role="alert" className="rounded-md border border-[var(--border)] px-3 py-2 text-body text-[var(--warning)]">
          {limitText(view.reason, locale)}
        </p>
      ) : null}

      {notice ? (
        <p role="alert" className="text-meta text-[var(--danger)]">
          {notice}
        </p>
      ) : null}

      {shown ? <AiResultView done={shown} /> : null}

      {shown && view.phase !== "pending" && view.phase !== "timeout" && view.phase !== "failed" ? (
        <div className="flex flex-col items-start gap-1">
          <button type="button" disabled={busy} onClick={() => void analyse(true)} className={buttonClass}>
            {busy ? tr("요청하는 중…", "Requesting…") : tr("다시 분석", "Analyse again")}
          </button>
          <p className="text-caption text-[var(--muted)]">
            {tr(
              "다시 분석은 유료 호출이며 GW마다 횟수가 제한됩니다. AI 문장은 참고용 해설이고 수치는 위 규칙 기반 값입니다.",
              "Analysing again is a paid call with a per-gameweek limit. The AI text is commentary for reference; the figures are the rules-based values."
            )}
          </p>
        </div>
      ) : null}
    </section>
  );
}
