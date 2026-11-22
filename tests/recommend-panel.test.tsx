import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AiOpinionPanel, POLL_GIVE_UP_MS, POLL_INTERVAL_MS } from "@/components/ai-opinion-panel";
import { LocaleProvider } from "@/components/locale-provider";
import { SquadPage } from "@/components/squad-page";
import { ALLOWED_ENTRY_IDS } from "@/lib/ai/allowed-entry";
import type { DonePayload } from "@/lib/ai/recommend";
import { buildEntrySquad } from "@/lib/entry-squad";
import { LOCALE_STORAGE_KEY } from "@/lib/locale";
import type { EntryRecommendPayload } from "@/lib/xp/recommend";
import type { TransferScenario } from "@/lib/xp/transfer-search";
import { makeAiInput, TEAM } from "./helpers/ai";
import { squadBootstrap, squadEntry, squadFixtures, squadHistory, squadPicks, squadTransfers } from "./helpers/entry-fpl";
import { nav } from "./helpers/mock-navigation";

vi.mock("next/navigation", () => import("./helpers/mock-navigation"));

// Issue #43 stage 4: the recommendation panel on /team/[id]. The allowed team sees the rules-based panel and
// the AI opinion; every other team ID sees the screen it had before, with no extra request. No test here
// reaches a network or a paid API: fetch is a fake that answers by address.

const WEEKS = Array.from({ length: 11 }, (_, index) => ({ event: index + 1 }));
function squadFor(entryId: number) {
  return buildEntrySquad({
    entryId,
    bootstrap: squadBootstrap(),
    fixtures: squadFixtures(),
    entry: squadEntry(),
    history: squadHistory(WEEKS, [{ name: "3xc", event: 3 }]),
    transfers: squadTransfers(),
    picks: squadPicks(11),
    squadGw: 11,
    eventPointsOverride: null,
    startPrices: new Map(),
    now: 1
  });
}

let recommend: EntryRecommendPayload;
let basis: DonePayload["basis"];

beforeAll(async () => {
  const made = await makeAiInput();
  recommend = made.payload;
  basis = made.input.basis;
});

const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));

type Handlers = {
  recommend?: (url: string) => Promise<Response>;
  aiGet?: () => Promise<Response>;
  aiPost?: (body: Record<string, unknown>) => Promise<Response>;
};

/** A fetch fake that answers by address and remembers every call. */
function installFetch(entryId: number, handlers: Handlers = {}) {
  const squad = squadFor(entryId);
  const calls: Array<{ url: string; method: string; body: Record<string, unknown> | null }> = [];
  const fake = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    const body = typeof init?.body === "string" ? (JSON.parse(init.body) as Record<string, unknown>) : null;
    calls.push({ url, method, body });
    if (url.startsWith("/api/entry-squad")) return json(squad);
    if (url.startsWith("/api/entry-recommend")) return handlers.recommend ? handlers.recommend(url) : json(recommend);
    if (url.startsWith("/api/entry-ai") && method === "POST") return handlers.aiPost ? handlers.aiPost(body!) : json({ status: "disabled" });
    if (url.startsWith("/api/entry-ai")) return handlers.aiGet ? handlers.aiGet() : json({ status: "disabled" });
    return json({}, 404);
  });
  vi.stubGlobal("fetch", fake);
  return { calls, fake };
}

function renderPage(entryId: number) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <LocaleProvider>
        <SquadPage entryId={entryId} />
      </LocaleProvider>
    </QueryClientProvider>
  );
}

function renderAi() {
  return render(
    <LocaleProvider>
      <AiOpinionPanel entryId={TEAM} />
    </LocaleProvider>
  );
}

function donePayload(overrides: Partial<DonePayload["result"]> = {}): DonePayload {
  const captains = recommend.captains;
  const scenarios = recommend.transfers!.scenarios;
  const one = scenarios.find((scenario) => scenario.type === "one")!;
  const roll = scenarios.find((scenario) => scenario.type === "roll")!;
  return {
    targetGw: recommend.targetGw,
    generation: 1,
    kind: "first",
    completedAt: "2026-11-22T12:30:00.000Z",
    modelId: "claude-fable-5-2",
    modelVersion: "xp1",
    basis,
    result: {
      summary: "A calm week: keep the squad and pick the captain with care.",
      lineup: { option_id: "L1", reason: "The recommended eleven has the best fixtures." },
      captain: [
        // The AI puts the rules-based number two first.
        { rank: 1, player_id: captains[1].id, reason: "A kinder fixture for the second name.", risk: "Could be rested." },
        { rank: 2, player_id: captains[0].id, reason: "Still very close.", risk: "Tougher opponent." }
      ],
      transfers: [
        { priority: 1, scenario_id: roll.id, reason: "No move beats the cost.", risk: "Prices may rise.", confidence: "medium" },
        { priority: 2, scenario_id: one.id, reason: "A small gain for the cost.", risk: "Might not play.", confidence: "low" }
      ],
      chip_note: "Hold the chips for now.",
      watch_list: [{ player_id: captains[0].id, note: "Check the news before the deadline." }],
      disagreements: [{ topic: "captain", note: "The second name has the better run of fixtures." }],
      ...overrides
    },
  };
}

beforeEach(() => {
  window.localStorage.clear();
  nav.set(`/team/${TEAM}`);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("who sees the recommendation panel", () => {
  it("allows only the owner's team (a code constant)", () => {
    expect(ALLOWED_ENTRY_IDS).toEqual([4300767]);
  });

  it("shows nothing and asks for nothing extra on any other team ID", async () => {
    const { calls } = installFetch(777);
    renderPage(777);
    await screen.findByRole("heading", { level: 1, name: "Test FC" });
    expect(screen.queryByRole("region", { name: "추천" })).not.toBeInTheDocument();
    expect(screen.queryByText(/AI 의견/)).not.toBeInTheDocument();
    expect(screen.queryByText(/추정·참고용 분석/)).not.toBeInTheDocument();
    expect(calls.map((call) => call.url)).toEqual(["/api/entry-squad?entryId=777"]);
  });
});

describe("rules-based panel (AI off)", () => {
  it("shows the fixed note, the lineup change, the captains with a recommendation weight, and the scenarios", async () => {
    installFetch(TEAM);
    renderPage(TEAM);
    const panel = await screen.findByRole("region", { name: "추천" });
    await within(panel).findByText("추천 선발·벤치");

    expect(within(panel).getByRole("note")).toHaveTextContent("아래는 추정·참고용 분석입니다. 최종 결정은 직접 하세요. 지난 마감(GW" + recommend.squadGw + ") 팀 기준이며 판매가·무료 이적 수는 추정입니다.");
    expect(within(panel).getByRole("note")).toHaveTextContent("비싼 선수를 낮게 볼 수 있습니다");
    expect(within(panel).getByText(new RegExp(`추천 대상 GW${recommend.targetGw}`))).toBeInTheDocument();

    // The lineup: the slots that change, out -> in, with the expected points.
    const best = recommend.lineups[0];
    expect(best.changes.length).toBeGreaterThan(0);
    expect(within(panel).getByText(new RegExp(`포메이션 ${best.formation}`))).toBeInTheDocument();
    expect(within(panel).getAllByText(`Zorro${best.changes[0].out}`).length).toBeGreaterThan(0);
    expect(within(panel).getAllByText(`Zorro${best.changes[0].in}`).length).toBeGreaterThan(0);
    expect(within(panel).getByText(/다른 선발안/)).toBeInTheDocument();

    // Captains: "추천 비중", never "확률" as a figure.
    const first = recommend.captains[0];
    expect(within(panel).getByText(`추천 비중 ${first.weightPct}%`)).toBeInTheDocument();
    expect(within(panel).getAllByText(/추천 비중 \d+%/)).toHaveLength(3);
    expect(within(panel).queryByText(/확률 \d+%/)).not.toBeInTheDocument();

    // Scenarios: roll, one, two, with the recommended one marked.
    expect(within(panel).getAllByText("권장")).toHaveLength(1);
    const recommended = recommend.transfers!.recommendedId;
    expect(panel.querySelector(`[data-scenario="${recommended}"]`)).toHaveTextContent("권장");
    expect(within(panel).getByText("넘기기 (이적 없음)")).toBeInTheDocument();
    expect(within(panel).getAllByText("1명 이적").length).toBeGreaterThan(0);
    expect(within(panel).getByText(/무료 이적 \d+개\(추정\)/)).toBeInTheDocument();
    // The buyers are not in the squad: their names come from the info the route adds.
    const buyer = recommend.transfers!.scenarios.find((scenario) => scenario.type === "one")!.in[0];
    expect(within(panel).getAllByText(`Zorro${buyer}`).length).toBeGreaterThan(0);
  });

  it("explains why a chip is missing and warns about a thin budget and a recommended chip", async () => {
    const scenarios = recommend.transfers!.scenarios;
    const template = scenarios.find((scenario) => scenario.type === "one")!;
    const wildcard: TransferScenario = {
      ...template,
      id: "wildcard",
      type: "wildcard",
      out: [11, 12],
      in: [43, 44],
      transferCost: 0,
      netGain: 12,
      bankAfter: 112,
      budgetTight: false,
      optimal: false
    };
    const tight = scenarios.map((scenario) => (scenario.id === template.id ? { ...scenario, budgetTight: true } : scenario));
    const withChip: EntryRecommendPayload = {
      ...recommend,
      transfers: { ...recommend.transfers!, scenarios: [...tight, wildcard], recommendedId: "wildcard", skipped: [{ type: "freehit", reason: "chip_used" }] }
    };
    installFetch(TEAM, { recommend: () => json(withChip) });
    renderPage(TEAM);
    const panel = await screen.findByRole("region", { name: "추천" });
    await within(panel).findByText("이적 시나리오");

    expect(within(panel).getByText(/프리 힛 안 없음: 이 기간의 칩을 이미 썼습니다/)).toBeInTheDocument();
    expect(panel.querySelector(`[data-scenario="${template.id}"]`)).toHaveTextContent("예산 여유 0.1 이하");
    const card = panel.querySelector('[data-scenario="wildcard"]')!;
    expect(card).toHaveTextContent("와일드카드");
    expect(card).toHaveTextContent("권장");
    expect(card).toHaveTextContent("근사 탐색");
    expect(card).toHaveTextContent("칩 사용은 신중히 하세요");
    expect(card).toHaveTextContent("£11.2m");
    expect(within(panel).getByText(/은행을 많이 남기고 비싼 선수를 낮게 평가할 수 있습니다/)).toBeInTheDocument();
  });

  it("switches the horizon to 5 gameweeks with one more request", async () => {
    const user = userEvent.setup();
    const { calls } = installFetch(TEAM);
    renderPage(TEAM);
    const panel = await screen.findByRole("region", { name: "추천" });
    await within(panel).findByText("이적 시나리오");
    expect(calls.some((call) => call.url.includes("entry-recommend") && call.url.includes("horizon=3"))).toBe(true);

    await user.click(within(panel).getByRole("button", { name: "5GW" }));
    await waitFor(() => expect(calls.some((call) => call.url.includes("horizon=5"))).toBe(true));
    expect(within(panel).getByRole("button", { name: "5GW" })).toHaveAttribute("aria-pressed", "true");
  });

  it("reads in English with the English wording of the codes", async () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, "en");
    installFetch(TEAM);
    renderPage(TEAM);
    const panel = await screen.findByRole("region", { name: "Recommendations" });
    await within(panel).findByText("Recommended XI and bench");
    expect(within(panel).getByRole("note")).toHaveTextContent("The analysis below is an estimate for reference. The final call is yours.");
    await userEvent.setup().click(within(panel).getByText("Assumptions and limits"));
    expect(within(panel).getByText(/The captain weight is a relative recommendation/)).toBeInTheDocument();
  });

  it("keeps the rules-based panel when the AI status cannot be read", async () => {
    installFetch(TEAM, { aiGet: () => json({ error: "x" }, 500) });
    renderPage(TEAM);
    const panel = await screen.findByRole("region", { name: "추천" });
    await within(panel).findByText("이적 시나리오");
    expect(screen.queryByRole("region", { name: "AI 의견" })).not.toBeInTheDocument();
  });
});

describe("AI opinion panel", () => {
  it("draws nothing when the layer is off or the team is not allowed", async () => {
    for (const status of ["disabled", "not_allowed"]) {
      const { calls } = installFetch(TEAM, { aiGet: () => json({ status }) });
      const { container, unmount } = renderAi();
      await waitFor(() => expect(calls).toHaveLength(1));
      await act(async () => {});
      expect(container).toBeEmptyDOMElement();
      expect(calls.every((call) => call.method === "GET")).toBe(true);
      unmount();
    }
  });

  it("reads the status on open with the language and shows a button, and posts nothing until it is pressed", async () => {
    const user = userEvent.setup();
    const { calls } = installFetch(TEAM, {
      aiGet: () => json({ status: "none" }),
      aiPost: () => json({ status: "pending", previous: null }, 202)
    });
    renderAi();
    const button = await screen.findByRole("button", { name: "AI 분석" });
    expect(calls).toEqual([{ url: `/api/entry-ai?entryId=${TEAM}&locale=ko`, method: "GET", body: null }]);
    expect(calls.filter((call) => call.method === "POST")).toHaveLength(0);

    await user.click(button);
    await screen.findByText("AI가 분석하는 중입니다…");
    expect(calls.filter((call) => call.method === "POST")).toEqual([
      { url: "/api/entry-ai", method: "POST", body: { entryId: TEAM, locale: "ko", regenerate: false } }
    ]);
  });

  it("shows the stored analysis with the numbers and the AI ranking side by side, and labels it", async () => {
    installFetch(TEAM, { aiGet: () => json({ status: "done", ...donePayload() }) });
    renderAi();
    const region = await screen.findByRole("region", { name: "AI 의견" });

    expect(within(region).getByText(/Claude Fable 5.2 분석 · 분석 시각 .+ · GW\d+ 대상/)).toBeInTheDocument();
    expect(within(region).getByText("A calm week: keep the squad and pick the captain with care.")).toBeInTheDocument();
    expect(within(region).getByText("선발 선택 이유")).toBeInTheDocument();
    expect(within(region).getByText("The recommended eleven has the best fixtures.")).toBeInTheDocument();

    // Captain: row 1 has the rules-based first name on the left and the AI's first name on the right.
    const captainRow = within(region).getByText("캡틴: 수치 기준과 AI 순위").parentElement!.querySelector("li")!;
    const [numbers, ai] = Array.from(captainRow.children) as HTMLElement[];
    const first = recommend.captains[0];
    const second = recommend.captains[1];
    expect(numbers).toHaveTextContent(`1. Zorro${first.id}`);
    expect(numbers).toHaveTextContent(`추천 비중 ${first.weightPct}%`);
    expect(ai).toHaveTextContent(`1. Zorro${second.id}`);
    expect(ai).toHaveTextContent("수치 기준과 다름");
    expect(ai).toHaveTextContent("A kinder fixture for the second name.");
    expect(ai).toHaveTextContent("위험: Could be rested.");
    // The figures beside the AI's pick are the server's, not the model's.
    expect(ai).toHaveTextContent(`추천 비중 ${second.weightPct}%`);

    // Transfers: priority, reason, risk, confidence, and the server's net gain.
    const transferRow = within(region).getByText("이적: 수치 기준과 AI 우선순위").parentElement!;
    expect(transferRow).toHaveTextContent("No move beats the cost.");
    expect(transferRow).toHaveTextContent("신뢰도 보통");
    expect(transferRow).toHaveTextContent("신뢰도 낮음");
    expect(transferRow).toHaveTextContent(/순이익 [+-]\d/);

    expect(within(region).getByText("칩 메모")).toBeInTheDocument();
    expect(within(region).getByText("Hold the chips for now.")).toBeInTheDocument();
    expect(within(region).getByText("지켜볼 선수")).toBeInTheDocument();
    expect(within(region).getByText("수치 기준과 다르게 본 점")).toBeInTheDocument();
    expect(within(region).getByRole("button", { name: "다시 분석" })).toBeInTheDocument();
  });

  it("draws the model's sentences as plain text: markup stays visible and nothing becomes a link", async () => {
    const hostile = donePayload({
      summary: "<b>bold</b> <img src=x onerror=alert(1)> see https://example.com [x](https://example.com)",
      lineup: { option_id: "L1", reason: "<script>alert(1)</script>" },
      chip_note: "<a href='https://example.com'>link</a>"
    });
    installFetch(TEAM, { aiGet: () => json({ status: "done", ...hostile }) });
    renderAi();
    const region = await screen.findByRole("region", { name: "AI 의견" });

    expect(within(region).getByText(/<b>bold<\/b> <img src=x onerror=alert\(1\)>/)).toBeInTheDocument();
    expect(within(region).getByText("<script>alert(1)</script>")).toBeInTheDocument();
    expect(region.querySelector("b, img, script, a")).toBeNull();
    expect(region.innerHTML).not.toContain("<b>");
  });

  it("polls every 5 seconds while the job runs, keeps the previous analysis on screen, and stops when it is done", async () => {
    vi.useFakeTimers();
    const previous = donePayload({ summary: "The previous analysis." });
    const finished = donePayload({ summary: "The fresh analysis." });
    let reads = 0;
    const { calls } = installFetch(TEAM, {
      aiGet: () => {
        reads += 1;
        return reads <= 3 ? json({ status: "pending", previous }, 202) : json({ status: "done", ...finished });
      }
    });
    renderAi();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByText("AI가 분석하는 중입니다…")).toBeInTheDocument();
    expect(screen.getByText("The previous analysis.")).toBeInTheDocument();
    expect(calls).toHaveLength(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS - 1);
    });
    expect(calls).toHaveLength(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(calls).toHaveLength(2);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 2);
    });
    expect(calls).toHaveLength(4);
    expect(screen.queryByText("AI가 분석하는 중입니다…")).not.toBeInTheDocument();
    expect(screen.getByText("The fresh analysis.")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 4);
    });
    expect(calls).toHaveLength(4);
    expect(calls.every((call) => call.method === "GET")).toBe(true);
  });

  it("stops polling while the tab is hidden and goes on when it is shown again", async () => {
    vi.useFakeTimers();
    const visibility = vi.spyOn(document, "visibilityState", "get");
    visibility.mockReturnValue("visible");
    const { calls } = installFetch(TEAM, { aiGet: () => json({ status: "pending", previous: null }, 202) });
    renderAi();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    });
    expect(calls).toHaveLength(2);

    visibility.mockReturnValue("hidden");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 3);
    });
    const whileHidden = calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 3);
    });
    expect(calls.length).toBe(whileHidden);
    expect(whileHidden).toBeLessThanOrEqual(3);

    visibility.mockReturnValue("visible");
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    });
    expect(calls.length).toBeGreaterThan(whileHidden);
  });

  it("gives up after 20 minutes with a note instead of polling forever", async () => {
    vi.useFakeTimers();
    const { calls } = installFetch(TEAM, { aiGet: () => json({ status: "pending", previous: null }, 202) });
    renderAi();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_GIVE_UP_MS + POLL_INTERVAL_MS * 2);
    });
    expect(screen.getByText(/분석이 오래 걸리고 있습니다/)).toBeInTheDocument();
    const total = calls.length;
    expect(total).toBeLessThanOrEqual(POLL_GIVE_UP_MS / POLL_INTERVAL_MS + 2);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 10);
    });
    expect(calls).toHaveLength(total);
  });

  it("goes from the button to the finished analysis by polling", async () => {
    vi.useFakeTimers();
    let reads = 0;
    const { calls } = installFetch(TEAM, {
      aiGet: () => {
        reads += 1;
        if (reads === 1) return json({ status: "none" });
        return reads === 2 ? json({ status: "pending", previous: null }, 202) : json({ status: "done", ...donePayload() });
      },
      aiPost: () => json({ status: "pending", previous: null }, 202)
    });
    renderAi();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(calls.filter((call) => call.method === "POST")).toHaveLength(0);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "AI 분석" }));
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(calls.filter((call) => call.method === "POST")).toHaveLength(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 2);
    });
    expect(screen.getByRole("button", { name: "다시 분석" })).toBeInTheDocument();
  });

  it.each([
    ["day", "오늘의 AI 분석 한도에 도달했습니다"],
    ["month", "이번 달 AI 분석 한도에 도달했습니다"],
    ["regen", "이번 GW에 다시 분석할 수 있는 횟수를 모두 썼습니다"]
  ])("says why 'analyse again' was refused (%s) and keeps the stored analysis", async (reason, sentence) => {
    const user = userEvent.setup();
    const stored = donePayload({ summary: "The stored analysis." });
    const { calls } = installFetch(TEAM, {
      aiGet: () => json({ status: "done", ...stored }),
      aiPost: () => json({ status: "limit", reason, previous: stored })
    });
    renderAi();
    await user.click(await screen.findByRole("button", { name: "다시 분석" }));
    expect(await screen.findByText(new RegExp(sentence))).toBeInTheDocument();
    expect(screen.getByText("The stored analysis.")).toBeInTheDocument();
    expect(calls.filter((call) => call.method === "POST")[0].body).toEqual({ entryId: TEAM, locale: "ko", regenerate: true });
  });

  it("says the analysis failed without printing the failure code, and offers another try", async () => {
    const user = userEvent.setup();
    const { calls } = installFetch(TEAM, {
      aiGet: () => json({ status: "failed", code: "api_overloaded" }),
      aiPost: () => json({ status: "pending", previous: null }, 202)
    });
    const { container } = renderAi();
    expect(await screen.findByText("AI 분석을 만들지 못했습니다. 수치 기준 결과를 참고하세요.")).toBeInTheDocument();
    expect(container).not.toHaveTextContent("api_overloaded");
    await user.click(screen.getByRole("button", { name: "다시 시도" }));
    await screen.findByText("AI가 분석하는 중입니다…");
    expect(calls.filter((call) => call.method === "POST")[0].body).toEqual({ entryId: TEAM, locale: "ko", regenerate: false });
  });

  it("tells a person who pressed too often to wait, without changing the screen", async () => {
    const user = userEvent.setup();
    installFetch(TEAM, {
      aiGet: () => json({ status: "none" }),
      aiPost: () => json({ error: "Too many requests" }, 429)
    });
    renderAi();
    await user.click(await screen.findByRole("button", { name: "AI 분석" }));
    expect(await screen.findByText(/요청이 많아 잠시 막혔습니다/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "AI 분석" })).toBeEnabled();
  });

  it("asks for the language on screen", async () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, "en");
    const { calls } = installFetch(TEAM, { aiGet: () => json({ status: "none" }) });
    renderAi();
    await screen.findByRole("button", { name: "AI analysis" });
    expect(calls[calls.length - 1].url).toBe(`/api/entry-ai?entryId=${TEAM}&locale=en`);
  });
});

describe("the allowed team's screen", () => {
  it("draws the AI opinion under the rules-based panel when the layer is on", async () => {
    installFetch(TEAM, { aiGet: () => json({ status: "none" }) });
    renderPage(TEAM);
    const panel = await screen.findByRole("region", { name: "추천" });
    expect(await within(panel).findByRole("button", { name: "AI 분석" })).toBeInTheDocument();
    expect(within(panel).getByRole("region", { name: "AI 의견" })).toBeInTheDocument();
  });
});
