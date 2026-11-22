import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "@/components/locale-provider";
import { SquadPage } from "@/components/squad-page";
import { TeamEntryPage } from "@/components/team-entry-page";
import { buildEntrySquad } from "@/lib/entry-squad";
import { MY_TEAM_KEY } from "@/lib/my-team";
import { SQUAD_VIEW_KEY } from "@/lib/squad-view";
import { nav } from "./helpers/mock-navigation";
import { squadBootstrap, squadEntry, squadFixtures, squadHistory, squadPicks, squadTransfers } from "./helpers/entry-fpl";

vi.mock("next/navigation", () => import("./helpers/mock-navigation"));

// Issue #39 stage 2: the squad screen reads like the official Pick Team / Transfers pages, read-only.
const WEEKS = Array.from({ length: 11 }, (_, index) => ({ event: index + 1 }));
const PAYLOAD = buildEntrySquad({
  entryId: 777,
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

function json(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
}

function renderPage(entryId = 777) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <LocaleProvider>
        <SquadPage entryId={entryId} />
      </LocaleProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  window.localStorage.clear();
  nav.set("/team/777");
  vi.stubGlobal("fetch", vi.fn(() => json(PAYLOAD)));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("squad page", () => {
  it("shows the team, the deadline note, the bank, the estimated free transfers and the chips", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { level: 1, name: "Test FC" })).toBeInTheDocument();
    expect(screen.getByText(/Kim Lee/)).toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent("GW11 마감 때의 팀");
    expect(screen.getByRole("note")).toHaveTextContent("추정값");

    const status = screen.getByRole("region", { name: "팀 현황" });
    expect(within(status).getByText("£0.5m")).toBeInTheDocument();
    // Free transfers carry the "추정" tag.
    const free = within(status).getByText("무료 이적").parentElement!;
    expect(free).toHaveTextContent("추정");
    expect(within(status).getByText("5개")).toBeInTheDocument();
    expect(within(status).getByText("GW3 사용")).toBeInTheDocument();
    expect(within(status).getAllByText("사용 가능").length).toBeGreaterThan(0);
  });

  it("shows captain, vice-captain, the bench in order and the next opponents on the pitch", async () => {
    renderPage();
    await screen.findByRole("heading", { level: 1, name: "Test FC" });
    expect(screen.getByTitle("주장")).toHaveTextContent("C");
    expect(screen.getByTitle("부주장")).toHaveTextContent("V");
    expect(screen.getByText("벤치 (왼쪽부터 교체 순서)")).toBeInTheDocument();
    // Saka has a double gameweek: both fixtures, each with home/away.
    expect(screen.getByText("CHE (H)")).toBeInTheDocument();
    expect(screen.getByText("LIV (A)")).toBeInTheDocument();
  });

  it("switches what the cards show, and remembers the choice", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("heading", { level: 1, name: "Test FC" });

    await user.selectOptions(screen.getByLabelText("카드에 표시"), "selling");
    expect(screen.getByText("£9.7m")).toBeInTheDocument(); // Saka: bought 9.5, now 10.0
    expect(screen.getByText("£10.5m")).toBeInTheDocument(); // Palmer: bought 10.0, now 11.0
    expect(JSON.parse(window.localStorage.getItem(SQUAD_VIEW_KEY)!)).toMatchObject({ metric: "selling" });

    await user.selectOptions(screen.getByLabelText("카드에 표시"), "change");
    expect(screen.getByText("+0.5")).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("카드에 표시"), "ownership");
    expect(screen.getByText("30.1%")).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("카드에 표시"), "form");
    expect(screen.getByText("7.5")).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("카드에 표시"), "points");
    expect(screen.getByText("6")).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("카드에 표시"), "fdr");
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("has a list view with every value at once, selling price marked as an estimate", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("heading", { level: 1, name: "Test FC" });
    await user.click(screen.getByRole("button", { name: "리스트" }));

    const table = screen.getByRole("table");
    expect(within(table).getByRole("columnheader", { name: "판매가(추정)" })).toBeInTheDocument();
    const saka = within(table).getByText("Saka").closest("tr")!;
    expect(saka).toHaveTextContent("£10.0m");
    expect(saka).toHaveTextContent("£9.7m");
    expect(saka).toHaveTextContent("CHE (H), LIV (A)");
    expect(within(table).getByText("Bench Guy").closest("tr")).toHaveTextContent("벤치 GK");
  });

  it("remembers the team as mine only when asked, in this browser only", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("heading", { level: 1, name: "Test FC" });
    expect(window.localStorage.getItem(MY_TEAM_KEY)).toBeNull();

    await user.click(screen.getByRole("button", { name: "내 팀으로 기억하기" }));
    expect(JSON.parse(window.localStorage.getItem(MY_TEAM_KEY)!)).toEqual({ id: 777, name: "Test FC" });
    await user.click(screen.getByRole("button", { name: /해제/ }));
    expect(window.localStorage.getItem(MY_TEAM_KEY)).toBeNull();
  });

  it("explains an unknown team and a rate limit instead of failing silently", async () => {
    vi.stubGlobal("fetch", vi.fn(() => json({ error: "Team not found" }, 404)));
    const { unmount } = renderPage();
    expect(await screen.findByRole("alert")).toHaveTextContent("이 팀 ID를 FPL에서 찾을 수 없습니다");
    unmount();

    vi.stubGlobal("fetch", vi.fn(() => json({ error: "slow down", retryAfterSeconds: 42 }, 429)));
    renderPage(778);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("42초 뒤"));
  });

  it("shows a note instead of a squad for a team with no gameweek past its deadline", async () => {
    const empty = buildEntrySquad({
      entryId: 9,
      bootstrap: squadBootstrap(),
      fixtures: squadFixtures(),
      entry: squadEntry(),
      history: squadHistory([]),
      transfers: [],
      picks: null,
      squadGw: null,
      eventPointsOverride: null,
      startPrices: new Map(),
      now: 1
    });
    vi.stubGlobal("fetch", vi.fn(() => json(empty)));
    renderPage(9);
    expect(await screen.findByText(/보여 줄 스쿼드가 없습니다/)).toBeInTheDocument();
  });

  it("uses the shared header: home logo and the My team menu", async () => {
    renderPage();
    await screen.findByRole("heading", { level: 1, name: "Test FC" });
    expect(screen.getByRole("link", { name: "FPL Live 홈으로" })).toBeInTheDocument();
    const menu = screen.getByRole("navigation", { name: "주요 메뉴" });
    expect(within(menu).getByRole("link", { name: "내 팀" })).toHaveAttribute("aria-current", "page");
  });
});

describe("team entry page (/team)", () => {
  it("asks for a team ID and saves the one typed as my team", async () => {
    const user = userEvent.setup();
    render(
      <LocaleProvider>
        <TeamEntryPage />
      </LocaleProvider>
    );
    const input = await screen.findByLabelText("FPL 팀 ID");

    await user.type(input, "12ab");
    await user.click(screen.getByRole("button", { name: "스쿼드 보기" }));
    expect(screen.getByRole("alert")).toHaveTextContent("숫자만");
    expect(window.localStorage.getItem(MY_TEAM_KEY)).toBeNull();

    await user.clear(input);
    await user.type(input, "4300767");
    await user.click(screen.getByRole("button", { name: "스쿼드 보기" }));
    expect(JSON.parse(window.localStorage.getItem(MY_TEAM_KEY)!)).toEqual({ id: 4300767, name: null });
    expect(nav.pushes).toContain("/team/4300767");
  });

  it("opens the remembered team straight away", async () => {
    window.localStorage.setItem(MY_TEAM_KEY, JSON.stringify({ id: 4300767, name: "Pleiades" }));
    render(
      <LocaleProvider>
        <TeamEntryPage />
      </LocaleProvider>
    );
    await waitFor(() => expect(nav.path).toBe("/team/4300767"));
  });
});
