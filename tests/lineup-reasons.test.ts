import { describe, expect, it } from "vitest";
import { buildLineupReasons } from "@/lib/xp/lineup-reasons";
import type { LineupPlayerCard, ScenarioLineup } from "@/lib/xp/recommend";

const card = (webName: string, position: string, xpNext: number, difficulty = 3): LineupPlayerCard => ({
  webName,
  teamShortName: "AAA",
  position,
  status: "a",
  news: "",
  photoUrl: null,
  xpNext,
  fixtures: [{ opponent: "COV", home: true, difficulty }],
  outlook: []
});

// 3-4-3: F4 (xP 4.4) out-scores the weakest outfield starter (D3, 4.0) but all 3 FWD slots are taken.
const cards: Record<string, LineupPlayerCard> = {
  1: card("Gk1", "GKP", 4),
  2: card("Gk2", "GKP", 3),
  3: card("D1", "DEF", 5),
  4: card("D2", "DEF", 4.5),
  5: card("D3", "DEF", 4),
  6: card("D4", "DEF", 3.7, 5),
  7: card("M1", "MID", 6),
  8: card("M2", "MID", 5.5),
  9: card("M3", "MID", 5),
  10: card("M4", "MID", 4.2),
  11: card("F1", "FWD", 5.0, 2),
  12: card("F2", "FWD", 4.8),
  13: card("F3", "FWD", 4.6),
  14: card("M5", "MID", 2),
  15: card("F4", "FWD", 4.4)
};
const lineup: ScenarioLineup = {
  formation: "3-4-3",
  starters: [1, 3, 4, 5, 7, 8, 9, 10, 11, 12, 13],
  bench: [2, 6, 14, 15],
  captainId: 7,
  viceCaptainId: 8,
  expectedPoints: 50,
  incoming: [11]
};

describe("buildLineupReasons (issue #83)", () => {
  const reasons = buildLineupReasons(lineup, cards, "ko", [{ inId: 11, outName: "Old", outXp: 3, outCost: 70, inCost: 75 }]);
  const text = (id: number, kind: string) => reasons.find((reason) => reason.id === id && reason.kind === kind)?.text ?? "";

  it("starter line: slots, xP, rank among the position and FDR match the cards", () => {
    expect(text(11, "starter")).toBe("F1 선발 — FWD 3자리 중 기대 5.0(4명 중 1위), 벤치 F4보다 0.6 높음, COV(H) FDR 2");
    expect(text(5, "starter")).toContain("DEF 3자리 중 기대 4.0(4명 중 3위)");
    expect(reasons.filter((reason) => reason.kind === "starter").length).toBe(11);
  });

  it("bench line: formation-bound player says the slots are full; order text for the first outfield bench", () => {
    expect(text(6, "bench")).toBe("D4 벤치 1 — DEF 4명 중 4위 기대 3.7(선발 3명보다 낮음), COV(H) FDR 5. 선발이 빠지면 가장 먼저 들어옴");
    expect(text(15, "bench")).toBe("F4 벤치 3 — 기대 4.4지만 포메이션 3-4-3의 FWD 3자리가 이미 참(선발 최저 4.6), COV(H) FDR 3. 교체 순서 3번째");
    expect(text(2, "bench")).toContain("후보 골키퍼 기대 3.0");
  });

  it("captain, vice-captain and the signing's IN line", () => {
    expect(text(7, "captain")).toContain("캡틴 M1 — 선발 중 기대 6.0(1위)");
    expect(text(8, "vice")).toContain("부캡틴 M2 — 선발 중 기대 5.5(2위)");
    expect(text(11, "in")).toBe("F1 IN — Old 대비 기대 +2.0, +£0.5m");
  });

  it("English text uses the same numbers", () => {
    const en = buildLineupReasons(lineup, cards, "en");
    expect(en.find((reason) => reason.id === 11 && reason.kind === "starter")?.text).toContain("xP 5.0 (#1 of 4 FWD)");
  });
});
