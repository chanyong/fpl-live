import { describe, expect, it } from "vitest";
import { leagueDescription, leagueTitle } from "@/lib/seo-text";

describe("league meta text", () => {
  it("keeps the description within 70–120 characters for any name length", () => {
    for (const name of ["A", "Overall", "우리 회사 FPL 리그", "x".repeat(80)]) {
      for (const gw of [null, 9, 38]) {
        const text = leagueDescription(name, gw);
        expect(text.length).toBeGreaterThanOrEqual(70);
        expect(text.length).toBeLessThanOrEqual(120);
      }
    }
  });

  it("puts the gameweek in the title", () => {
    expect(leagueTitle("Overall", 9)).toBe("Overall 실시간 순위 · GW 9 | FPL Live");
    expect(leagueTitle("Overall", null)).toBe("Overall 실시간 순위 | FPL Live");
  });
});
