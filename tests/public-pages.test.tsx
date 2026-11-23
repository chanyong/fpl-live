import { readFileSync } from "node:fs";
import { join } from "node:path";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import sitemap from "@/app/sitemap";
import { llmsText } from "@/lib/llms-text";
import { buildPublicFootball, buildPublicPlayers } from "@/lib/public-football";
import { PUBLIC_MENU, PUBLIC_PAGES, publicPageMetadata } from "@/lib/public-pages";
import { bootstrapFixture, fixturesFixture } from "./helpers/public-fpl";

// Issue #33 stage 2: the three league-free pages are real server-rendered pages, in the sitemap, each with
// its own title, description, canonical and share card.
const mocks = vi.hoisted(() => ({ football: vi.fn(), players: vi.fn() }));
vi.mock("@/lib/public-data", () => ({ getPublicFootball: mocks.football, getPublicPlayers: mocks.players }));

import PremierLeagueRoute from "@/app/premier-league/page";
import FixturesRoute from "@/app/fixtures/page";
import PlayersRoute from "@/app/players/page";

const EVENTS = [{ id: 9, finished: true }, { id: 10, is_current: true }, { id: 11, is_next: true }];
const FIXTURES = fixturesFixture([
  { id: 1, event: 9, kickoff_time: "2026-11-01T14:00:00Z", team_h: 1, team_a: 2, team_h_score: 2, team_a_score: 0, started: true, finished: true, finished_provisional: true },
  { id: 2, event: 10, kickoff_time: "2026-11-08T14:00:00Z", team_h: 3, team_a: 4 },
  { id: 3, event: 11, kickoff_time: "2026-11-15T20:00:00Z", team_h: 2, team_a: 1 }
]);

beforeEach(() => {
  const bootstrap = bootstrapFixture(EVENTS);
  mocks.football.mockResolvedValue(buildPublicFootball(bootstrap, FIXTURES));
  mocks.players.mockResolvedValue(buildPublicPlayers(bootstrap, FIXTURES));
});

async function html(route: (props: { searchParams?: Promise<{ gw?: string }> }) => Promise<React.ReactElement>) {
  return renderToString(<QueryClientProvider client={new QueryClient()}>{await route({})}</QueryClientProvider>);
}

describe("public page metadata", () => {
  it.each(["premier-league", "fixtures", "players"] as const)("%s has its own title, description, canonical and share image", (key) => {
    const meta = publicPageMetadata(key);
    const page = PUBLIC_PAGES[key];
    expect(meta.title).toBe(page.title);
    expect(meta.description).toBe(page.description);
    expect(page.description.length).toBeGreaterThanOrEqual(70);
    expect(page.description.length).toBeLessThanOrEqual(120);
    expect(meta.alternates?.canonical).toBe(page.path);
    // Setting openGraph in a page drops the file-based share card unless images are named here.
    expect(meta.openGraph?.images).toEqual([expect.objectContaining({ url: "/opengraph-image" })]);
    expect(meta.twitter?.images).toEqual([expect.objectContaining({ url: "/opengraph-image" })]);
  });

  it("gives the four menu pages different titles and addresses", () => {
    const pages = PUBLIC_MENU.map((key) => PUBLIC_PAGES[key]);
    expect(new Set(pages.map((page) => page.title)).size).toBe(pages.length);
    expect(new Set(pages.map((page) => page.path)).size).toBe(pages.length);
  });
});

describe("sitemap and llms.txt", () => {
  it("lists the league-free pages and no mini-league page", () => {
    const urls = sitemap().map((entry) => entry.url);
    for (const key of ["premier-league", "fixtures", "players", "price-changes"] as const) {
      expect(urls.some((url) => url.endsWith(PUBLIC_PAGES[key].path))).toBe(true);
    }
    expect(urls.some((url) => url.includes("/league"))).toBe(false);
  });

  it("tells assistants about the new pages", () => {
    const text = llmsText("https://example.test");
    for (const path of ["/premier-league", "/fixtures", "/players"]) {
      expect(text).toContain(`https://example.test${path}`);
    }
  });
});

describe("server-rendered pages", () => {
  it("/premier-league puts the real table in the HTML", async () => {
    const out = await html(PremierLeagueRoute);
    expect(out).toContain("<h1");
    expect(out).toContain("Arsenal");
    expect(out).toContain("Everton");
    expect(out).toContain("<table");
    expect(out).not.toContain("불러오는 중");
  });

  it("/premier-league puts the team difficulty grid above the table, as the league 팀 tab does", async () => {
    const out = await html(PremierLeagueRoute);
    expect(out).toContain("팀별 향후 일정 난이도");
    expect(out.indexOf("팀별 향후 일정 난이도")).toBeLessThan(out.indexOf("프리미어리그 현재 순위"));
  });

  it("/fixtures draws the league screen's card list, kickoff times in KST, with gameweek buttons and no league-only parts", async () => {
    const out = await html(FixturesRoute);
    expect(out).toContain("게임위크 10 경기");
    expect(out).toContain('aria-label="경기 상태 필터"');
    expect(out).toContain("Liverpool");
    expect(out).toContain('href="/fixtures?gw=9"');
    expect(out).toContain('href="/fixtures?gw=11"');
    expect(out).not.toContain("리그 보유");
    expect(out).not.toContain("보유 선수 없음");
    // 2026-11-08T14:00Z is 23:00 in Korea.
    expect(out).toContain("23:00");
  });

  it("/fixtures?gw=11 lists that gameweek: 2026-11-15T20:00Z is 05:00 the next morning in Korea", async () => {
    mocks.football.mockResolvedValue(buildPublicFootball(bootstrapFixture(EVENTS), FIXTURES, 11));
    const out = renderToString(<QueryClientProvider client={new QueryClient()}>{await FixturesRoute({ searchParams: Promise.resolve({ gw: "11" }) })}</QueryClientProvider>);
    expect(mocks.football).toHaveBeenCalledWith(11);
    expect(out).toContain("게임위크 11 경기");
    expect(out).toContain("05:00");
    expect(out).toContain("11월 16일");
    expect(out).toContain('href="/fixtures"');
  });

  it("/players has the league screen's sub-tabs minus 우리 리그, the position filter and the price table, no league-only cells", async () => {
    const out = await html(PlayersRoute);
    expect(out).toContain("Saka");
    expect(out).toContain("Palmer");
    expect(out).toContain('role="tablist"');
    expect(out).toContain("이적 시장");
    expect(out).toContain("선수 성과");
    expect(out).not.toContain("우리 리그");
    expect(out).toContain("포지션 필터");
    expect(out).not.toContain("리그 보유만");
    expect(out).not.toContain("리그 최다 보유");
  });

  it("the menu pages and the league tabs draw the same components", () => {
    const read = (file: string) => readFileSync(join(process.cwd(), file), "utf8");
    const dashboard = read("components/league-dashboard.tsx");
    for (const [page, component] of [
      ["app/premier-league/page.tsx", "TeamsPanel"],
      ["app/fixtures/page.tsx", "FixturesPanel"],
      ["app/players/page.tsx", "PlayerTrendsPanel"]
    ] as const) {
      expect(read(page)).toContain(`<${component}`);
      expect(dashboard).toContain(`<${component}`);
    }
  });

  it("every page carries the top menu with all four pages", async () => {
    for (const route of [PremierLeagueRoute, FixturesRoute, PlayersRoute]) {
      const out = await html(route);
      for (const key of PUBLIC_MENU) {
        expect(out).toContain(`href="${PUBLIC_PAGES[key].path}"`);
      }
    }
  });

  it("shows a notice, not an error, when FPL gave nothing", async () => {
    mocks.football.mockResolvedValue(null);
    mocks.players.mockResolvedValue(null);
    for (const route of [PremierLeagueRoute, FixturesRoute, PlayersRoute]) {
      const out = await html(route);
      expect(out).toContain("<h1");
      expect(out).toContain("응답하지 않아");
    }
  });
});
