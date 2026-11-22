import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LeagueDashboard } from "@/components/league-dashboard";
import type { LeagueLiveResponse } from "@/lib/types";
import { nav } from "./helpers/mock-navigation";

// Issue #33: each dashboard tab has its own address. A tab click changes the address (no reload) and the
// screen follows the address, so refresh, back and shared links land on the same screen.
vi.mock("next/navigation", () => import("./helpers/mock-navigation"));
vi.mock("@/components/fixtures-panel", () => ({ FixturesPanel: () => <div>FIXTURES_PANEL</div> }));
vi.mock("@/components/league-table", () => ({ LeagueTable: () => <div>TABLE_PANEL</div> }));
vi.mock("@/components/league-kpis", () => ({ LeagueKpis: () => null }));
vi.mock("@/components/captain-stats", () => ({ CaptainStats: () => null }));
vi.mock("@/components/rank-movement-card", () => ({ RankMovementCard: () => null }));
vi.mock("@/components/rival-card", () => ({ RivalCard: () => null, useRivalPick: () => [{ me: null, rival: null }, () => undefined] }));
vi.mock("@/components/rank-change-panel", () => ({ RankChangePanel: () => <div>TREND_PANEL</div> }));
vi.mock("@/components/team-fixture-table", () => ({ TeamFixtureTable: () => <div>TEAMS_PANEL</div> }));
vi.mock("@/components/premier-league-table", () => ({ PremierLeagueTable: () => null }));
vi.mock("@/components/player-trends-panel", () => ({ PlayerTrendsPanel: () => <div>PLAYERS_PANEL</div> }));

const LEAGUE_ID = "915874";

const LIVE = {
  league: { id: 915874, name: "Test League", currentGw: 10, lastUpdated: "2026-10-31T12:00:00Z", isProvisional: true, nextDeadline: null },
  captainStats: [],
  fixtures: [],
  rows: [],
  errors: []
} as unknown as LeagueLiveResponse;

const PLAYER_STATS = { league: { id: 915874, name: "Test League", currentGw: 10 }, table: [] };
const RANK_CHANGE = { league: { id: 915874, name: "Test League", currentGw: 10 } };

function stubFetch() {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const body = url.startsWith("/api/league-live") ? LIVE : url.startsWith("/api/player-stats") ? PLAYER_STATS : RANK_CHANGE;
    return { ok: true, json: async () => body } as unknown as Response;
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderAt(path: string) {
  nav.set(path);
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <LeagueDashboard leagueId={LEAGUE_ID} buildId="test" />
    </QueryClientProvider>
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  nav.pushes.length = 0;
  nav.set(`/league/${LEAGUE_ID}`);
});

describe("league dashboard tab addresses", () => {
  it("opens the first screen on the plain league address and links every tab to its own address", async () => {
    stubFetch();
    renderAt(`/league/${LEAGUE_ID}`);

    expect(await screen.findByText("FIXTURES_PANEL")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "경기 일정" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "주간 순위" })).toHaveAttribute("href", `/league/${LEAGUE_ID}`);
    expect(screen.getByRole("tab", { name: "순위표" })).toHaveAttribute("href", `/league/${LEAGUE_ID}/standings/table`);
    expect(screen.getByRole("tab", { name: "순위 추이" })).toHaveAttribute("href", `/league/${LEAGUE_ID}/standings/trend`);
    expect(screen.getByRole("tab", { name: "팀" })).toHaveAttribute("href", `/league/${LEAGUE_ID}/teams`);
    expect(screen.getByRole("tab", { name: "선수" })).toHaveAttribute("href", `/league/${LEAGUE_ID}/players`);
  });

  it.each([
    ["/standings/table", "TABLE_PANEL"],
    ["/standings/trend", "TREND_PANEL"],
    ["/teams", "TEAMS_PANEL"],
    ["/players", "PLAYERS_PANEL"]
  ])("opens straight onto %s when the address is loaded or shared", async (suffix, marker) => {
    stubFetch();
    renderAt(`/league/${LEAGUE_ID}${suffix}`);

    expect(await screen.findByText(marker)).toBeInTheDocument();
    expect(screen.queryByText("FIXTURES_PANEL")).not.toBeInTheDocument();
  });

  it("changes the address on a plain click without refetching league data, and follows the address on back", async () => {
    const fetchMock = stubFetch();
    renderAt(`/league/${LEAGUE_ID}`);
    await screen.findByText("FIXTURES_PANEL");
    const leagueCalls = () => fetchMock.mock.calls.filter(([url]) => String(url).startsWith("/api/league-live")).length;
    const before = leagueCalls();

    fireEvent.click(screen.getByRole("tab", { name: "순위표" }));
    expect(nav.pushes).toEqual([`/league/${LEAGUE_ID}/standings/table`]);
    expect(await screen.findByText("TABLE_PANEL")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "선수" }));
    expect(nav.pushes.at(-1)).toBe(`/league/${LEAGUE_ID}/players`);
    expect(await screen.findByText("PLAYERS_PANEL")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "선수" })).toHaveAttribute("aria-selected", "true");

    // Coming back to 주간 순위 reopens the sub-tab used last.
    expect(screen.getByRole("tab", { name: "주간 순위" })).toHaveAttribute("href", `/league/${LEAGUE_ID}/standings/table`);

    // Browser back: the address changes, the screen follows.
    act(() => nav.set(`/league/${LEAGUE_ID}/standings/table`));
    expect(await screen.findByText("TABLE_PANEL")).toBeInTheDocument();

    // Same cached league data the whole time: tab switches did not reload it.
    expect(leagueCalls()).toBe(before);
  });

  it("leaves modified clicks (new tab) to the browser", async () => {
    stubFetch();
    renderAt(`/league/${LEAGUE_ID}`);
    await screen.findByText("FIXTURES_PANEL");

    // jsdom cannot navigate; this listener records whether the app held the click back, then stops jsdom.
    let heldBack = true;
    const record = (event: Event) => {
      heldBack = event.defaultPrevented;
      event.preventDefault();
    };
    document.addEventListener("click", record);
    fireEvent.click(screen.getByRole("tab", { name: "팀" }), { ctrlKey: true });
    document.removeEventListener("click", record);

    expect(heldBack).toBe(false);
    expect(nav.pushes).toEqual([]);
  });
});
