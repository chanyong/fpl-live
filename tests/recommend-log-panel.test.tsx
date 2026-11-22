import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AiOpinionPanel } from "@/components/ai-opinion-panel";
import { LocaleProvider } from "@/components/locale-provider";
import { RecommendLogPanel } from "@/components/recommend-log-panel";
import { RecommendPanel } from "@/components/recommend-panel";
import { computeActual, type AiLogSummary, type LogEntryView, type RulesSummary } from "@/lib/ai/rec-log";
import { LOCALE_STORAGE_KEY } from "@/lib/locale";
import type { EntryRecommendPayload } from "@/lib/xp/recommend";
import { TEAM, makeAiInput } from "./helpers/ai";
import { mkPoints, mkSummary } from "./helpers/rec-log";

// Issue #43 stage 5: the folded "past recommendations" section and the 80% line of the AI panel. Fetch is a fake
// that answers by address; nothing reaches a network or a paid API.
const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));

function view(summary: RulesSummary, withResult: boolean, gw = summary.targetGw): LogEntryView {
  return {
    targetGw: gw,
    modelVersion: "xp1",
    recordedAt: summary.recordedAt,
    summary: { ...summary, targetGw: gw },
    actual: withResult ? computeActual({ ...summary, targetGw: gw }, { points: mkPoints(), picks: { captainId: 33, multiplier: 2, points: 58, transferCost: 4 } }, 1) : null
  };
}

const withAi: AiLogSummary = {
  generation: 1,
  locale: "ko",
  captains: [33],
  lineupId: "L2",
  lineup: { formation: "4-4-2", starters: [2, 15, 12, 13, 14, 21, 22, 23, 24, 31, 33], bench: [1, 11, 25, 32], expectedPoints: 1 },
  transferId: "one:25>41",
  transfer: { id: "one:25>41", type: "one", out: [25], in: [41], transferCost: 0, netGain: 3 },
  recordedAt: "2026-11-22T12:00:00.000Z"
};

function renderLog(entries: LogEntryView[] | "error", locale: "ko" | "en" = "ko") {
  window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  const fake = vi.fn((input: RequestInfo | URL) => {
    if (String(input).startsWith("/api/entry-recommend-log")) return entries === "error" ? json({ error: "x" }, 500) : json({ entries });
    return json({}, 404);
  });
  vi.stubGlobal("fetch", fake);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <LocaleProvider>
        <RecommendLogPanel entryId={TEAM} />
      </LocaleProvider>
    </QueryClientProvider>
  );
  return fake;
}

const openSection = async (name: RegExp | string = "지난 추천 기록(참고)") => {
  await userEvent.click(screen.getByText(name));
};

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("past recommendations (reference)", () => {
  it("is folded and asks for nothing until it is opened", async () => {
    const fake = renderLog([]);
    expect(screen.getByText("지난 추천 기록(참고)")).toBeInTheDocument();
    expect(fake).not.toHaveBeenCalled();
    await openSection();
    await waitFor(() => expect(fake).toHaveBeenCalledTimes(1));
    expect(String(fake.mock.calls[0][0])).toBe(`/api/entry-recommend-log?entryId=${TEAM}`);
  });

  it("with no record: the small-sample warning and the waiting sentence", async () => {
    renderLog([]);
    await openSection();
    expect(await screen.findByText("아직 기록이 없습니다. 다음 GW가 끝나면 채워집니다.")).toBeInTheDocument();
    expect(screen.getByText("표본이 작아 참고용입니다. 한 팀·GW당 1건이라 한 시즌으로도 통계적 결론은 약합니다.")).toBeInTheDocument();
  });

  it("with a record: captain with the real score and whether it was the best, XI against the best XI, transfers, and what was really played", async () => {
    renderLog([view(mkSummary(), true, 11)]);
    await openSection();
    const item = (await screen.findByText("GW11")).closest("li")!;
    const text = item.textContent ?? "";
    expect(text).toContain("수치 1순위 P31 실제 10점");
    expect(text).toContain("후보 중 최고였음");
    expect(text).toContain("추천 선발 50점 / 최적 72점 (69%)");
    expect(text).toContain("1명 이적 1순위");
    expect(text).toContain("P25 → P41");
    expect(text).toContain("실제 순이익 +10점 (들어온 선수 11점 − 나간 선수 1점 − 비용 0점)");
    expect(text).toContain("실제 순이익 -8점");
    expect(text).toContain("캡틴 P33 12점");
    expect(text).toContain("팀 58점");
    // No AI in this record: no AI block.
    expect(within(item).queryByText("AI")).not.toBeInTheDocument();
  });

  it("says in words when the first pick was not the best of the candidates", async () => {
    const summary = mkSummary({ captains: [{ id: 21, xp: 7, weightPct: 50 }, { id: 31, xp: 6, weightPct: 50 }] });
    renderLog([view(summary, true)]);
    await openSection();
    expect(await screen.findByText(/후보 중 최고는 아니었음 \(최고 P31 10점\)/)).toBeInTheDocument();
  });

  it("shows the AI's side with its comparison when the AI was there", async () => {
    renderLog([view(mkSummary({ ai: withAi }), true)]);
    await openSection();
    const item = (await screen.findByText("GW12")).closest("li")!;
    const ai = within(item).getByText("AI").parentElement!;
    expect(ai.textContent).toContain("캡틴 P33 실제 12점 (수치 기준보다 나음)");
    expect(ai.textContent).toContain("선발 L2 실제 72점 (수치 기준보다 나음)");
    expect(ai.textContent).toContain("이적 1순위 실제 순이익 +10점 (수치 기준과 같음)");
  });

  it("a gameweek still open is a waiting line with the numbers' pick, not a result", async () => {
    renderLog([view(mkSummary({ ai: withAi }), false)]);
    await openSection();
    const item = (await screen.findByText("GW12")).closest("li")!;
    expect(item.textContent).toContain("수치 1순위 P31");
    expect(item.textContent).toContain("AI P33");
    expect(item.textContent).toContain("결과 대기 중");
    expect(item.textContent).not.toContain("최적");
  });

  it("speaks English with the language switch, and tells the reader when the record cannot be loaded", async () => {
    renderLog([view(mkSummary(), true)], "en");
    await openSection("Past recommendations (for reference)");
    const item = (await screen.findByText("GW12")).closest("li")!;
    expect(item.textContent).toContain("top pick P31 scored 10");
    expect(item.textContent).toContain("the best of the candidates");
    expect(item.textContent).toContain("recommended XI 50 / best XI 72 (69%)");
    expect(screen.getByText(/The sample is small, so this is for reference only/)).toBeInTheDocument();
  });

  it("shows a notice instead of breaking when the request fails", async () => {
    renderLog("error");
    await openSection();
    expect(await screen.findByRole("alert")).toHaveTextContent("기록을 불러오지 못했습니다");
  });

  it("keeps long lines inside a 375px column: no fixed widths, text can wrap", async () => {
    renderLog([view(mkSummary({ ai: withAi }), true)]);
    await openSection();
    const item = (await screen.findByText("GW12")).closest("li")!;
    expect(item.className).toContain("min-w-0");
    for (const paragraph of item.querySelectorAll("p")) {
      expect(paragraph.getAttribute("style") ?? "").not.toMatch(/width|white-space/);
      expect(paragraph.className).not.toMatch(/whitespace-nowrap|w-\[/);
    }
    expect(item.querySelector("table")).toBeNull();
  });
});

describe("inside the recommendation panel", () => {
  let recommend: EntryRecommendPayload;
  beforeAll(async () => {
    recommend = (await makeAiInput()).payload;
  });

  it("sits under the AI opinion and asks the log only when opened", async () => {
    const fake = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/api/entry-recommend-log")) return json({ entries: [] });
      if (url.startsWith("/api/entry-recommend")) return json(recommend);
      return json({ status: "disabled" });
    });
    vi.stubGlobal("fetch", fake);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <LocaleProvider>
          <RecommendPanel entryId={TEAM} />
        </LocaleProvider>
      </QueryClientProvider>
    );
    expect(await screen.findByText("지난 추천 기록(참고)")).toBeInTheDocument();
    expect(fake.mock.calls.some((call) => String(call[0]).startsWith("/api/entry-recommend-log"))).toBe(false);
  });
});

describe("the 80% line of the AI panel", () => {
  function renderAi(body: Record<string, unknown>) {
    vi.stubGlobal("fetch", vi.fn(() => json(body)));
    render(
      <LocaleProvider>
        <AiOpinionPanel entryId={TEAM} />
      </LocaleProvider>
    );
  }

  it("is shown when the server says near_limit", async () => {
    renderAi({ status: "none", budgetNotice: "near_limit" });
    expect(await screen.findByText("이번 달 AI 분석 한도의 80%를 넘었습니다.")).toBeInTheDocument();
    // The button is still there: the notice is a warning, not a block.
    expect(screen.getByRole("button", { name: "AI 분석" })).toBeInTheDocument();
  });

  it("is not shown for null or when the field is missing", async () => {
    renderAi({ status: "none", budgetNotice: null });
    await screen.findByRole("button", { name: "AI 분석" });
    expect(screen.queryByText(/80%/)).not.toBeInTheDocument();
  });
});
