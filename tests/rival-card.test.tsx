import { QueryClient, QueryClientProvider, focusManager } from "@tanstack/react-query";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LeagueDashboard } from "@/components/league-dashboard";
import { RivalCard, useRivalPick } from "@/components/rival-card";
import type { LeagueLiveResponse, LeagueRow } from "@/lib/types";

// The panels around the card need full FPL payloads; this file is only about the me/rival choice.
vi.mock("@/components/fixtures-panel", () => ({ FixturesPanel: () => null }));
vi.mock("@/components/league-table", () => ({ LeagueTable: () => null }));
vi.mock("@/components/league-kpis", () => ({ LeagueKpis: () => null }));
vi.mock("@/components/captain-stats", () => ({ CaptainStats: () => null }));
vi.mock("@/components/rank-movement-card", () => ({ RankMovementCard: () => null }));
vi.mock("@/components/rank-change-panel", () => ({ RankChangePanel: () => null }));
vi.mock("@/components/team-fixture-table", () => ({ TeamFixtureTable: () => null }));
vi.mock("@/components/premier-league-table", () => ({ PremierLeagueTable: () => null }));
vi.mock("@/components/player-trends-panel", () => ({ PlayerTrendsPanel: () => null }));

const LEAGUE_ID = "915874";
const TITLE = "라이벌 점수 차";

function row(entryId: number, rank: number, gwPoints: number, total: number): LeagueRow {
  return {
    entryId,
    rank,
    lastRank: rank,
    projectedRank: rank,
    teamName: `Team ${entryId}`,
    managerName: `Manager ${entryId}`,
    captainName: `Captain ${entryId}`,
    chip: null,
    playersPlayed: 0,
    gwPoints,
    totalPoints: total,
    projectedTotalPoints: total,
    lineupPoints: gwPoints,
    transferCost: 0,
    squad: { starters: [], bench: [] },
    calculationStatus: "ok",
    provisional: true
  };
}

const ROWS = [row(1, 1, 50, 500), row(2, 2, 40, 480), row(3, 3, 30, 470)];

function payload(rows: LeagueRow[]): LeagueLiveResponse {
  return {
    league: {
      id: Number(LEAGUE_ID),
      name: "Test League",
      currentGw: 10,
      lastUpdated: "2026-10-31T12:00:00Z",
      isProvisional: true,
      nextDeadline: null
    },
    captainStats: [],
    fixtures: [],
    rows,
    errors: []
  };
}

/** Serves the league from `current.rows`; player data never arrives (the 팀·선수 tabs just show loading). */
function stubFetch(current: { rows: LeagueRow[] }) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    if (String(input).startsWith("/api/league-live")) {
      return { ok: true, json: async () => payload(current.rows) } as unknown as Response;
    }
    return new Promise<Response>(() => undefined);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function newClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderDashboard(client = newClient()) {
  return render(
    <QueryClientProvider client={client}>
      <LeagueDashboard leagueId={LEAGUE_ID} buildId="test" />
    </QueryClientProvider>
  );
}

function selects() {
  return { me: screen.getByLabelText("나"), rival: screen.getByLabelText("라이벌") };
}

function choose(me: number, rival: number) {
  fireEvent.change(selects().me, { target: { value: String(me) } });
  fireEvent.change(selects().rival, { target: { value: String(rival) } });
}

function expectPick(me: string, rival: string) {
  expect(selects().me).toHaveValue(me);
  expect(selects().rival).toHaveValue(rival);
}

function Harness({ rows, leagueId = LEAGUE_ID, showCard = true }: { rows: LeagueRow[]; leagueId?: string; showCard?: boolean }) {
  const [pick, setPick] = useRivalPick(leagueId);
  return showCard ? <RivalCard rows={rows} pick={pick} onPickChange={setPick} /> : null;
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  focusManager.setFocused(undefined);
  window.localStorage.clear();
});

describe("RivalCard choice", () => {
  it("starts with nobody chosen (the removed instruction note stays gone)", () => {
    render(<Harness rows={ROWS} />);

    expectPick("", "");
    expect(screen.queryByText(/페이지를 새로 열면/)).not.toBeInTheDocument();
    expect(screen.queryByText(/기억/)).not.toBeInTheDocument();
  });

  it("labels the total gap as provisional while the gameweek is live", () => {
    render(<Harness rows={ROWS} />);

    choose(1, 2);

    expect(screen.getByText("총점(잠정)")).toBeInTheDocument();
    expect(screen.getByText("+20")).toBeInTheDocument();
  });

  it("ignores a choice saved by an earlier version and deletes it", () => {
    window.localStorage.setItem(`fpl-live-rival:${LEAGUE_ID}`, JSON.stringify({ me: 1, rival: 2 }));
    window.localStorage.setItem("fpl-live-rival:123", JSON.stringify({ me: 7, rival: 8 }));
    window.localStorage.setItem("fpl-live-locale", "en");

    render(<Harness rows={ROWS} />);

    expectPick("", "");
    expect(window.localStorage.getItem(`fpl-live-rival:${LEAGUE_ID}`)).toBeNull();
    expect(window.localStorage.getItem("fpl-live-rival:123")).toBeNull();
    // Other settings of this site are left alone.
    expect(window.localStorage.getItem("fpl-live-locale")).toBe("en");
  });

  it("does not write the choice to the browser", () => {
    render(<Harness rows={ROWS} />);
    choose(1, 2);

    expect(window.localStorage.length).toBe(0);
  });

  it("keeps the choice when the data refreshes and while the card is hidden", () => {
    const view = render(<Harness rows={ROWS} />);
    choose(1, 2);
    expect(screen.getByText("+10")).toBeInTheDocument();

    view.rerender(<Harness rows={[row(1, 1, 58, 508), row(2, 2, 40, 480), row(3, 3, 30, 470)]} />);
    expectPick("1", "2");
    expect(screen.getByText("+18")).toBeInTheDocument();

    view.rerender(<Harness rows={ROWS} showCard={false} />);
    expect(screen.queryByText(TITLE)).not.toBeInTheDocument();
    view.rerender(<Harness rows={ROWS} />);
    expectPick("1", "2");
  });

  it("still works when the browser blocks storage", () => {
    // Private modes and blocked site data make even reading window.localStorage throw.
    const original = Object.getOwnPropertyDescriptor(window, "localStorage");
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("The operation is insecure.", "SecurityError");
      }
    });
    try {
      render(<Harness rows={ROWS} />);
      expectPick("", "");
      choose(1, 2);
      expectPick("1", "2");
    } finally {
      if (original) {
        Object.defineProperty(window, "localStorage", original);
      } else {
        delete (window as unknown as Record<string, unknown>).localStorage;
      }
    }
  });

  it("starts empty for a different league", () => {
    const view = render(<Harness rows={ROWS} />);
    choose(1, 2);

    view.rerender(<Harness rows={ROWS} leagueId="123" />);
    expectPick("", "");
  });
});

describe("LeagueDashboard rival choice", () => {
  it("survives the 30-second refresh, tab switches and a return to the browser tab", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const current = { rows: ROWS };
    const fetchMock = stubFetch(current);
    renderDashboard();

    expect(await screen.findByText(TITLE)).toBeInTheDocument();
    expectPick("", "");

    choose(1, 2);
    expect(screen.getByText("+10")).toBeInTheDocument();

    // The automatic refresh brings new points; the choice stays and the gap follows.
    current.rows = [row(1, 1, 55, 505), row(2, 2, 40, 480), row(3, 3, 30, 470)];
    const callsBefore = fetchMock.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(fetchMock.mock.calls.length).toBeGreaterThan(callsBefore);
    expect(await screen.findByText("+15")).toBeInTheDocument();
    expectPick("1", "2");

    // 팀 and 선수 tabs unmount the card; coming back shows the same choice.
    fireEvent.click(screen.getByRole("tab", { name: "팀" }));
    expect(screen.queryByText(TITLE)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "선수" }));
    fireEvent.click(screen.getByRole("tab", { name: "주간 순위" }));
    expect(screen.getByText(TITLE)).toBeInTheDocument();
    expectPick("1", "2");

    // Sub-tabs of 주간 순위.
    fireEvent.click(screen.getByRole("tab", { name: "순위표" }));
    fireEvent.click(screen.getByRole("tab", { name: "순위 추이" }));
    fireEvent.click(screen.getByRole("tab", { name: "경기 일정" }));
    expectPick("1", "2");

    // Leaving for another browser tab and coming back refetches; the choice stays.
    const callsBeforeFocus = fetchMock.mock.calls.length;
    await act(async () => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(fetchMock.mock.calls.length).toBeGreaterThan(callsBeforeFocus);
    expectPick("1", "2");

    expect(window.localStorage.getItem(`fpl-live-rival:${LEAGUE_ID}`)).toBeNull();
  });

  it("starts empty again when the page is opened anew", async () => {
    const client = newClient();
    stubFetch({ rows: ROWS });
    const first = renderDashboard(client);

    await screen.findByText(TITLE);
    choose(1, 2);
    expectPick("1", "2");
    first.unmount();

    // Even with the league data still cached (navigating back within the site), the choice is gone.
    renderDashboard(client);
    await screen.findByText(TITLE);
    expectPick("", "");
  });

  it("starts empty even if an earlier version saved a choice for this league", async () => {
    window.localStorage.setItem(`fpl-live-rival:${LEAGUE_ID}`, JSON.stringify({ me: 1, rival: 2 }));
    stubFetch({ rows: ROWS });
    renderDashboard();

    await screen.findByText(TITLE);
    expectPick("", "");
    expect(window.localStorage.getItem(`fpl-live-rival:${LEAGUE_ID}`)).toBeNull();
  });
});
