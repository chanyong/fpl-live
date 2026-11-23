import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FdrCells } from "@/components/fdr-cells";
import { LocaleProvider } from "@/components/locale-provider";
import { buildEntrySquad } from "@/lib/entry-squad";
import {
  formatPriceChangeMoney,
  formatPriceChangePercent,
  metricLabel,
  outlookWeeks,
  parseFdrHorizon,
  priceChangeTone
} from "@/lib/squad-view";
import type { SquadPlayer } from "@/lib/squad-types";
import { squadBootstrap, squadEntry, squadFixtures, squadHistory, squadPicks, squadTransfers } from "./helpers/entry-fpl";

// Issue #74: the card's FDR is the next 3 or 5 gameweeks as colour cells; the price change is money first.
const game = (opponent: string, home: boolean, difficulty: number) => ({ opponent, home, difficulty });

function player(outlook: SquadPlayer["outlook"], extra: Partial<SquadPlayer> = {}): SquadPlayer {
  return { fixtures: outlook?.[0]?.games ?? [], outlook, nowCost: 100, costChangeStart: 0, ...extra } as SquadPlayer;
}

function cells(p: SquadPlayer, horizon: 3 | 5) {
  const { container } = render(
    <LocaleProvider>
      <FdrCells player={p} horizon={horizon} />
    </LocaleProvider>
  );
  return container;
}

const FIVE = [
  { gw: 12, games: [game("CHE", true, 2), game("LIV", false, 5)] }, // double
  { gw: 13, games: [game("MCI", true, 3)] },
  { gw: 14, games: [] }, // blank
  { gw: 15, games: [game("EVE", false, 4)] },
  { gw: 16, games: [game("WOL", true, 1)] }
];

describe("FDR cells", () => {
  it("draws 3 cells by default and 5 on request", () => {
    expect(cells(player(FIVE), 3).querySelectorAll("[data-fdr-cell]")).toHaveLength(3);
    document.body.innerHTML = "";
    expect(cells(player(FIVE), 5).querySelectorAll("[data-fdr-cell]")).toHaveLength(5);
  });

  it("uses the FPL colour scale per game", () => {
    const container = cells(player(FIVE), 5);
    const styleOf = (n: number) => (container.querySelector(`[data-difficulty="${n}"]`) as HTMLElement).getAttribute("style");
    for (const n of [1, 2, 3, 4, 5]) {
      expect(styleOf(n)).toContain(`--fdr-${n}`);
    }
  });

  it("stacks both games of a double week in one cell and leaves a blank week as a dash", () => {
    const container = cells(player(FIVE), 5);
    const week12 = container.querySelector('[data-gw="12"]')!;
    expect(week12.querySelectorAll("[data-fdr-game]")).toHaveLength(2);
    const blank = container.querySelector('[data-gw="14"]')!;
    expect(blank.querySelectorAll("[data-fdr-game]")).toHaveLength(0);
    expect(blank.textContent).toBe("–");
  });

  it("prints the opponent and H/A only in the 3-game view (hidden below lg by class)", () => {
    const three = cells(player(FIVE), 3);
    expect(three.querySelector("[data-fdr-opp]")?.className).toContain("hidden");
    expect(three.querySelector("[data-fdr-opp]")?.className).toContain("lg:block");
    expect(three.textContent).toContain("CHE H");
    document.body.innerHTML = "";
    expect(cells(player(FIVE), 5).querySelector("[data-fdr-opp]")).toBeNull();
  });

  it("falls back to the single next week for an older payload without an outlook", () => {
    const old = player(undefined, {});
    old.fixtures = [game("ARS", false, 4)];
    expect(outlookWeeks(old, 5)).toEqual([{ gw: 0, games: [game("ARS", false, 4)] }]);
    expect(outlookWeeks({ fixtures: [], outlook: undefined }, 3)).toEqual([]);
  });

  it("reads the saved horizon, 3 unless it was 5", () => {
    expect(parseFdrHorizon(null)).toBe(3);
    expect(parseFdrHorizon("5")).toBe(5);
    expect(parseFdrHorizon("bogus")).toBe(3);
  });
});

describe("squad outlook from FPL fixtures", () => {
  it("gives 5 weeks from the next gameweek: a double, a single, blank weeks", () => {
    const fixtures = [
      ...(squadFixtures() as unknown[]),
      { id: 9, event: 13, team_h: 1, team_a: 3, started: false, finished: false, finished_provisional: false, team_h_difficulty: 3, team_a_difficulty: 2 }
    ];
    const data = buildEntrySquad({
      entryId: 777,
      bootstrap: squadBootstrap(),
      fixtures: fixtures as ReturnType<typeof squadFixtures>,
      entry: squadEntry(),
      history: squadHistory(Array.from({ length: 11 }, (_, index) => ({ event: index + 1 }))),
      transfers: squadTransfers(),
      picks: squadPicks(11),
      squadGw: 11,
      eventPointsOverride: null,
      startPrices: new Map(),
      now: 1
    });
    const saka = data.squad.find((p) => p.webName === "Saka")!;
    expect(saka.outlook!.map((week) => week.gw)).toEqual([12, 13, 14, 15, 16]);
    expect(saka.outlook![0].games).toHaveLength(2);
    expect(saka.outlook![1].games).toHaveLength(1);
    expect(saka.outlook![2].games).toEqual([]);
    expect(saka.fixtures).toEqual(saka.outlook![0].games);
  });
});

describe("price change on a card", () => {
  it("is money with a sign and the unit, rises green and falls red", () => {
    expect(formatPriceChangeMoney(3)).toBe("+£0.3m");
    expect(formatPriceChangeMoney(-2)).toBe("−£0.2m");
    expect(formatPriceChangeMoney(0)).toBe("£0.0m");
    expect(priceChangeTone(3)).toContain("emerald");
    expect(priceChangeTone(-2)).toContain("danger");
    expect(priceChangeTone(0)).toBe("");
  });

  it("gives the percentage of the opening price as the secondary figure", () => {
    expect(formatPriceChangePercent({ nowCost: 62, costChangeStart: 3 })).toBe("+5.1%");
    expect(formatPriceChangePercent({ nowCost: 48, costChangeStart: -2 })).toBe("−4.0%");
    expect(formatPriceChangePercent({ nowCost: 50, costChangeStart: 0 })).toBe("0.0%");
    expect(formatPriceChangePercent({ nowCost: 5, costChangeStart: 5 })).toBeNull();
  });

  it("names its basis in the label", () => {
    expect(metricLabel("change", "ko")).toContain("시즌 시작가 대비");
  });
});
