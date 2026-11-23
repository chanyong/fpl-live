import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AiFullView } from "@/components/ai-full-view";
import { AiOpinionPanel } from "@/components/ai-opinion-panel";
import { LocaleProvider } from "@/components/locale-provider";
import type { FullDonePayload } from "@/lib/ai/full-flow";
import type { FullInput } from "@/lib/ai/full-input";
import { validateFullOutput } from "@/lib/ai/full-schema";
import { LOCALE_STORAGE_KEY } from "@/lib/locale";
import { makeFullInput, TEAM, validFullAnswer } from "./helpers/ai";

// Issue #85: the "full AI" box and the screen of its answer. fetch is a fake that answers by address.

let full: FullInput;
let verified: FullDonePayload;
let fallback: FullDonePayload;

const payloadOf = (result: FullDonePayload["result"]): FullDonePayload => ({
  targetGw: full.basis.targetGw,
  generation: 1,
  kind: "first",
  completedAt: "2026-11-23T12:30:00.000Z",
  modelId: "claude-fable-5-2",
  modelVersion: "xp1",
  result
});

beforeAll(async () => {
  full = (await makeFullInput()).full;
  const checked = validateFullOutput(validFullAnswer(), full.context);
  if (!checked.ok) throw new Error(checked.code);
  verified = payloadOf(full.finalize(checked.value));
  fallback = payloadOf(full.fallback("captain_not_starter"));
});

beforeEach(() => {
  window.localStorage.clear();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));

type Call = { url: string; method: string; body: Record<string, unknown> | null };
function installFetch(handlers: { get?: (full: boolean) => Promise<Response>; post?: (body: Record<string, unknown>) => Promise<Response> } = {}) {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const body = typeof init?.body === "string" ? (JSON.parse(init.body) as Record<string, unknown>) : null;
      calls.push({ url, method, body });
      if (method === "POST") return handlers.post ? handlers.post(body!) : json({ status: "disabled" });
      return handlers.get ? handlers.get(url.includes("mode=full")) : json({ status: "none" });
    })
  );
  return calls;
}

const renderPanel = () =>
  render(
    <LocaleProvider>
      <AiOpinionPanel entryId={TEAM} />
    </LocaleProvider>
  );

describe("the full-AI box", () => {
  it("is off by default, asks for nothing extra, and a press posts the ranking mode", async () => {
    const user = userEvent.setup();
    const calls = installFetch({ post: () => json({ status: "pending", previous: null }, 202) });
    renderPanel();
    const box = await screen.findByRole("checkbox", { name: "전체 AI 이용" });
    expect(box).not.toBeChecked();
    expect(calls.map((call) => call.url)).toEqual([`/api/entry-ai?entryId=${TEAM}&locale=ko`]);

    await user.click(screen.getByRole("button", { name: "AI 분석" }));
    expect(calls.filter((call) => call.method === "POST").map((call) => call.body)).toEqual([{ entryId: TEAM, locale: "ko", regenerate: false }]);
  });

  it("when ticked it is remembered, reads the full status only, and a press posts mode full", async () => {
    const user = userEvent.setup();
    const calls = installFetch({
      get: () => json({ status: "none" }),
      post: () => json({ status: "pending", previous: null }, 202)
    });
    renderPanel();
    await user.click(await screen.findByRole("checkbox", { name: "전체 AI 이용" }));
    expect(screen.getByRole("checkbox", { name: "전체 AI 이용" })).toBeChecked();
    expect(window.localStorage.getItem("fpl-ai-full")).toBe("1");
    await waitFor(() => expect(calls.some((call) => call.url.includes("mode=full"))).toBe(true));
    // Ticking posts nothing.
    expect(calls.filter((call) => call.method === "POST")).toHaveLength(0);

    await user.click(screen.getByRole("button", { name: "AI 분석" }));
    expect(calls.filter((call) => call.method === "POST").map((call) => call.body)).toEqual([{ entryId: TEAM, locale: "ko", regenerate: false, mode: "full" }]);
    await screen.findByText("AI가 선발·이적을 고르는 중입니다…");
  });

  it("is already ticked on the next visit", async () => {
    window.localStorage.setItem("fpl-ai-full", "1");
    const calls = installFetch();
    renderPanel();
    await waitFor(() => expect(screen.getByRole("checkbox", { name: "전체 AI 이용" })).toBeChecked());
    await waitFor(() => expect(calls.some((call) => call.url.includes("mode=full"))).toBe(true));
  });

  it("is switched off with a note when this month's limit is near, and then asks nothing for the full mode", async () => {
    window.localStorage.setItem("fpl-ai-full", "1");
    const calls = installFetch({ get: () => json({ status: "none", budgetNotice: "near_limit" }) });
    renderPanel();
    const box = await screen.findByRole("checkbox", { name: "전체 AI 이용" });
    await waitFor(() => expect(box).toBeDisabled());
    expect(box).not.toBeChecked();
    expect(screen.getAllByText(/한도에 가까워 전체 AI는 쓸 수 없습니다/).length).toBeGreaterThan(0);
    // The press goes the ranking way.
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "AI 분석" }));
    const posts = calls.filter((call) => call.method === "POST");
    expect(posts.every((call) => !("mode" in (call.body ?? {})))).toBe(true);
  });

  it("is switched off when the server answers that the month's cap is reached", async () => {
    const user = userEvent.setup();
    installFetch({
      get: () => json({ status: "none" }),
      post: () => json({ status: "limit", reason: "month", previous: null })
    });
    renderPanel();
    await user.click(await screen.findByRole("checkbox", { name: "전체 AI 이용" }));
    await user.click(screen.getByRole("button", { name: "AI 분석" }));
    await waitFor(() => expect(screen.getByRole("checkbox", { name: "전체 AI 이용" })).toBeDisabled());
  });

  it("shows the finished plan under the opinion and offers 'Analyse again'", async () => {
    const user = userEvent.setup();
    const calls = installFetch({
      get: (isFull) => json(isFull ? { status: "done", ...verified } : { status: "none" })
    });
    renderPanel();
    await user.click(await screen.findByRole("checkbox", { name: "전체 AI 이용" }));
    await screen.findByText("AI 전체 추천 (참고용)");
    expect(await screen.findByRole("button", { name: "다시 분석" })).toBeInTheDocument();
    expect(calls.filter((call) => call.method === "POST")).toHaveLength(0);
  });
});

describe("the full-AI answer screen", () => {
  const renderView = (done: FullDonePayload) =>
    render(
      <LocaleProvider>
        <AiFullView done={done} />
      </LocaleProvider>
    );

  it("draws the plan on the shared pitch with IN marked, a reason for every player, and the difference from the rules engine", () => {
    const { container } = renderView(verified);
    expect(container.querySelector("[data-scenario-pitch]")).not.toBeNull();
    expect(container.querySelector("[data-verified='yes']")).not.toBeNull();
    expect(screen.getByText("IN = 새로 영입")).toBeInTheDocument();
    expect(screen.getAllByText(/Zorro21/).length).toBeGreaterThan(0);

    // Reasons by role: starters, bench, IN, OUT. 42 comes in, 21 goes out.
    const reasons = container.querySelector("[data-full-reasons]") as HTMLElement;
    expect(within(reasons).getByText("IN (새로 영입)")).toBeInTheDocument();
    expect(within(reasons).getByText("OUT (내보냄)")).toBeInTheDocument();
    expect(within(reasons).getByText(/Comes in: the best fixtures/)).toBeInTheDocument();
    expect(within(reasons).getByText(/Sold: a quiet run of fixtures/)).toBeInTheDocument();
    // Fifteen players of the new squad and one sold: sixteen lines.
    expect(reasons.querySelectorAll("li")).toHaveLength(16);

    // Money and the comparison come from the server's figures.
    expect(screen.getByText(/이적 1명 · 감점 -0/)).toBeInTheDocument();
    const compare = container.querySelector("[data-full-compare]") as HTMLElement;
    expect(within(compare).getByText("선발 기대 점수")).toBeInTheDocument();
    expect(within(compare).getByText("이적 뒤 은행")).toBeInTheDocument();
    expect(screen.getByText(/AI 결과는 참고용입니다/)).toBeInTheDocument();
  });

  it("draws the model's sentences as plain text", () => {
    const html = "<img src=x onerror=alert(1)>";
    const done: FullDonePayload = { ...verified, result: { ...verified.result, summary: html } };
    const { container } = renderView(done);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText(html)).toBeInTheDocument();
  });

  it("says the check failed and shows the rules engine's option, without any AI reasons", () => {
    const { container } = renderView(fallback);
    expect(container.querySelector("[data-verified='no']")).not.toBeNull();
    expect(screen.getByText("검증 실패")).toBeInTheDocument();
    expect(screen.getByText(/규칙 엔진의 최선안으로 대체했습니다/)).toBeInTheDocument();
    expect(container.querySelector("[data-full-reasons]")).toBeNull();
    expect(container.querySelector("[data-full-compare]")).toBeNull();
    expect(container.querySelector("[data-scenario-pitch]")).not.toBeNull();
  });

  it("reads in English", () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, "en");
    act(() => undefined);
    renderView(verified);
    expect(screen.getByText("Reason for each player (AI)")).toBeInTheDocument();
  });
});
