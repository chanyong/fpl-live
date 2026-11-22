import { describe, expect, it } from "vitest";
import { isStandingsView, leagueViewPath, tabOfView, viewFromSegments, type LeagueView } from "@/lib/league-views";
import { leagueViewDescription, leagueViewTitle } from "@/lib/seo-text";

const VIEWS: LeagueView[] = ["fixtures", "table", "rank-change", "teams", "players"];

describe("league view addresses (issue #33)", () => {
  it("maps each screen to its address", () => {
    expect(leagueViewPath(915874, "fixtures")).toBe("/league/915874");
    expect(leagueViewPath("915874", "table")).toBe("/league/915874/standings/table");
    expect(leagueViewPath("915874", "rank-change")).toBe("/league/915874/standings/trend");
    expect(leagueViewPath("915874", "teams")).toBe("/league/915874/teams");
    expect(leagueViewPath("915874", "players")).toBe("/league/915874/players");
  });

  it("reads the screen back from the address (round trip)", () => {
    for (const view of VIEWS) {
      const below = leagueViewPath(1, view).split("/").slice(3);
      expect(viewFromSegments(below)).toBe(view);
    }
  });

  it("falls back to the default screen for an old or unknown address", () => {
    expect(viewFromSegments([])).toBe("fixtures");
    expect(viewFromSegments(["standings"])).toBe("fixtures");
    expect(viewFromSegments(["nope"])).toBe("fixtures");
  });

  it("groups the screens under the three top tabs", () => {
    expect(tabOfView("fixtures")).toBe("standings");
    expect(tabOfView("table")).toBe("standings");
    expect(tabOfView("rank-change")).toBe("standings");
    expect(tabOfView("teams")).toBe("team");
    expect(tabOfView("players")).toBe("player");
    expect(isStandingsView("teams")).toBe(false);
    expect(isStandingsView("table")).toBe(true);
  });
});

describe("league view page text", () => {
  it("gives every screen its own title and keeps the default screen's title", () => {
    expect(leagueViewTitle("Overall", 9, "fixtures")).toBe("Overall 실시간 순위 · GW 9 | FPL Live");
    const titles = VIEWS.map((view) => leagueViewTitle("Overall", 9, view));
    expect(new Set(titles).size).toBe(VIEWS.length);
    expect(leagueViewTitle("Overall", null, "players")).toBe("Overall 선수 통계·추이 | FPL Live");
  });

  it("keeps every description within 70–120 characters and different per screen", () => {
    for (const name of ["A", "Overall", "우리 회사 FPL 리그", "x".repeat(80)]) {
      const texts = VIEWS.map((view) => leagueViewDescription(name, 9, view));
      for (const text of texts) {
        expect(text.length).toBeGreaterThanOrEqual(70);
        expect(text.length).toBeLessThanOrEqual(120);
      }
      expect(new Set(texts).size).toBe(VIEWS.length);
    }
  });
});
