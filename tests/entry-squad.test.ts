import { beforeEach, describe, expect, it, vi } from "vitest";
import { elementSummarySchema, liveSchema } from "@/lib/validators";
import { squadBootstrap, squadEntry, squadFixtures, squadHistory, squadPicks, squadTransfers } from "./helpers/entry-fpl";

const fpl = vi.hoisted(() => ({
  getBootstrapStatic: vi.fn(),
  getFixtures: vi.fn(),
  getEntry: vi.fn(),
  getEntryHistory: vi.fn(),
  getEntryTransfers: vi.fn(),
  getEntryPicks: vi.fn(),
  getEventLive: vi.fn(),
  getElementSummary: vi.fn()
}));
vi.mock("@/lib/fpl-client", async (importActual) => ({ ...(await importActual<typeof import("@/lib/fpl-client")>()), ...fpl }));

import { FplRequestError } from "@/lib/fpl-client";
import { resetPublicDataCache } from "@/lib/public-data";
import {
  buildEntrySquad,
  EntryBusyError,
  EntryNotFoundError,
  FplUnavailableError,
  getEntrySquad,
  resetEntrySquadCache
} from "@/lib/entry-squad";

// Issue #39 stage 2: the squad screen's data, assembled from FPL's public endpoints.
const WEEKS_1_TO_11 = Array.from({ length: 11 }, (_, index) => ({ event: index + 1 }));

function inputs(overrides: Partial<Parameters<typeof buildEntrySquad>[0]> = {}) {
  return {
    entryId: 777,
    bootstrap: squadBootstrap(),
    fixtures: squadFixtures(),
    entry: squadEntry(),
    history: squadHistory(WEEKS_1_TO_11),
    transfers: squadTransfers(),
    picks: squadPicks(11),
    squadGw: 11,
    eventPointsOverride: null,
    startPrices: new Map<number, number>(),
    now: 1,
    ...overrides
  };
}

beforeEach(() => {
  resetPublicDataCache();
  resetEntrySquadCache();
  for (const mock of Object.values(fpl)) mock.mockReset();
  fpl.getBootstrapStatic.mockResolvedValue(squadBootstrap());
  fpl.getFixtures.mockResolvedValue(squadFixtures());
  fpl.getEntry.mockResolvedValue(squadEntry());
  fpl.getEntryHistory.mockResolvedValue(squadHistory(WEEKS_1_TO_11));
  fpl.getEntryTransfers.mockResolvedValue(squadTransfers());
  fpl.getEntryPicks.mockResolvedValue(squadPicks(11));
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("buildEntrySquad", () => {
  it("lists the squad in FPL's pick order with captain, vice-captain and the bench", () => {
    const data = buildEntrySquad(inputs());
    expect(data.squad.map((player) => player.webName)).toEqual(["Keeper", "Saka", "Palmer", "Bench Guy"]);
    expect(data.squad.map((player) => player.isStarter)).toEqual([true, true, true, false]);
    expect(data.squad.find((player) => player.isCaptain)?.webName).toBe("Saka");
    expect(data.squad.find((player) => player.isViceCaptain)?.webName).toBe("Palmer");
    expect(data.teamName).toBe("Test FC");
    expect(data.managerName).toBe("Kim Lee");
    expect(data.gw).toBe(11);
    expect(data.nextGw).toBe(12);
    expect(data.nextDeadline).toBe("2026-11-27T18:30:00Z");
  });

  it("estimates selling prices from the price paid", () => {
    const data = buildEntrySquad(inputs());
    const byName = Object.fromEntries(data.squad.map((player) => [player.webName, player]));
    // Held since the first squad: opening price 100 - 5 = 95, now 100 -> 95 + floor(5 / 2).
    expect(byName.Saka.purchaseCost).toBe(95);
    expect(byName.Saka.sellingPrice).toBe(97);
    // Bought at 100, now 110.
    expect(byName.Palmer.sellingPrice).toBe(105);
    // Bought at 50, fell to 40: paid out at 40.
    expect(byName["Bench Guy"].sellingPrice).toBe(40);
    expect(byName.Keeper.sellingPrice).toBe(45);
    expect(data.squadValue).toBe(295);
    expect(data.squadSellingValue).toBe(287);
    expect(data.bank).toBe(5);
  });

  it("gives next gameweek's opponents with home or away and difficulty, a double included", () => {
    const data = buildEntrySquad(inputs());
    const saka = data.squad.find((player) => player.webName === "Saka")!;
    expect(saka.fixtures).toEqual([
      { opponent: "CHE", home: true, difficulty: 2 },
      { opponent: "LIV", home: false, difficulty: 5 }
    ]);
    const palmer = data.squad.find((player) => player.webName === "Palmer")!;
    expect(palmer.fixtures).toEqual([{ opponent: "ARS", home: false, difficulty: 4 }]);
  });

  it("shows this gameweek's player points, and lists the 8 chips", () => {
    const data = buildEntrySquad(inputs({ history: squadHistory(WEEKS_1_TO_11, [{ name: "3xc", event: 3 }]) }));
    expect(data.squad.find((player) => player.webName === "Saka")?.eventPoints).toBe(6);
    expect(data.chips).toHaveLength(8);
    expect(data.chips.find((chip) => chip.name === "3xc" && chip.startEvent === 1)?.state).toEqual({ kind: "used", event: 3 });
  });

  it("estimates free transfers for the next gameweek and counts transfers already listed for it", () => {
    const quiet = buildEntrySquad(inputs());
    expect(quiet.transfers.freeTransfers).toBe(5);
    expect(quiet.transfers.pendingTransfers).toBe(0);

    const pending = buildEntrySquad(
      inputs({
        transfers: squadTransfers([
          { element_in: 10, element_in_cost: 100, element_out: 11, element_out_cost: 110, entry: 777, event: 12, time: "2026-11-23T00:00:00Z" }
        ])
      })
    );
    expect(pending.transfers.pendingTransfers).toBe(1);
  });

  it("records the last gameweek's transfers and cost as FPL reports them", () => {
    const weeks = [...WEEKS_1_TO_11.slice(0, 10), { event: 11, transfers: 3, cost: 4 }];
    const data = buildEntrySquad(inputs({ history: squadHistory(weeks) }));
    expect(data.transfers.lastGwTransfers).toBe(3);
    expect(data.transfers.lastGwCost).toBe(4);
  });

  it("leaves the selling price empty when the price paid cannot be known", () => {
    // Joined in gameweek 5 and held Saka from the first squad with no transfer record and no price looked up.
    const data = buildEntrySquad(inputs({ entry: squadEntry({ started_event: 5 }) }));
    const saka = data.squad.find((player) => player.webName === "Saka")!;
    expect(saka.sellingPrice).toBeNull();
    expect(data.squadSellingValue).toBeNull();

    const priced = buildEntrySquad(inputs({ entry: squadEntry({ started_event: 5 }), startPrices: new Map([[10, 90], [13, 45]]) }));
    expect(priced.squad.find((player) => player.webName === "Saka")?.sellingPrice).toBe(95);
  });

  it("returns an empty squad for a team with no gameweek on record", () => {
    const data = buildEntrySquad(inputs({ history: squadHistory([]), picks: null, squadGw: null }));
    expect(data.gw).toBeNull();
    expect(data.squad).toEqual([]);
    expect(data.transfers.freeTransfers).toBeNull();
  });
});

describe("getEntrySquad", () => {
  it("reads the last gameweek on record and fetches each FPL page once, then serves a cached copy", async () => {
    const first = await getEntrySquad(777);
    const second = await getEntrySquad(777);
    expect(second).toBe(first);
    expect(fpl.getEntryPicks).toHaveBeenCalledTimes(1);
    expect(fpl.getEntryPicks).toHaveBeenCalledWith(777, 11);
    expect(fpl.getEntryTransfers).toHaveBeenCalledTimes(1);

    await getEntrySquad(777, true);
    expect(fpl.getEntryPicks).toHaveBeenCalledTimes(2);
  });

  it("shares one set of FPL calls between simultaneous requests for a team", async () => {
    await Promise.all([getEntrySquad(777), getEntrySquad(777), getEntrySquad(777)]);
    expect(fpl.getEntryHistory).toHaveBeenCalledTimes(1);
  });

  it("answers 'not found' for a team FPL does not know", async () => {
    fpl.getEntry.mockRejectedValue(new FplRequestError("FPL request failed: /entry/1/ (404)", 404, false, null));
    await expect(getEntrySquad(1)).rejects.toBeInstanceOf(EntryNotFoundError);
  });

  it("reports other FPL failures (maintenance, rate limit) as an outage", async () => {
    fpl.getEntry.mockRejectedValue(new FplRequestError("FPL request failed (503)", 503, true, null));
    await expect(getEntrySquad(2)).rejects.toBeInstanceOf(FplUnavailableError);
    fpl.getEntry.mockResolvedValue(squadEntry());
    fpl.getEntryPicks.mockRejectedValue(new FplRequestError("FPL request failed (503)", 503, true, null));
    await expect(getEntrySquad(2)).rejects.toBeInstanceOf(FplUnavailableError);
  });

  it("loads at most 5 teams from FPL at the same time, whoever asks", async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    fpl.getEntry.mockImplementation(async () => {
      await gate;
      return squadEntry();
    });

    const running = [101, 102, 103, 104, 105].map((id) => getEntrySquad(id));
    await expect(getEntrySquad(106)).rejects.toBeInstanceOf(EntryBusyError);
    // A team already being loaded still shares that load.
    const shared = getEntrySquad(101);
    release();
    await Promise.all([...running, shared]);
    await expect(getEntrySquad(106)).resolves.toMatchObject({ entryId: 106 });
  });

  it("starts at most 60 loads a minute and serves cached teams regardless", async () => {
    for (let id = 1; id <= 60; id += 1) {
      await getEntrySquad(1000 + id);
    }
    const busy = await getEntrySquad(2000).catch((error: unknown) => error);
    expect(busy).toBeInstanceOf(EntryBusyError);
    expect((busy as EntryBusyError).retryAfterSeconds).toBeGreaterThan(0);
    await expect(getEntrySquad(1001)).resolves.toMatchObject({ entryId: 1001 });
  });

  it("reports FPL as unavailable when the shared data is missing and nothing is cached", async () => {
    fpl.getBootstrapStatic.mockRejectedValue(new Error("down"));
    await expect(getEntrySquad(3)).rejects.toBeInstanceOf(FplUnavailableError);
  });

  it("shows the squad from before a Free Hit week and ignores that week's transfers", async () => {
    fpl.getEntryHistory.mockResolvedValue(squadHistory(WEEKS_1_TO_11, [{ name: "freehit", event: 11 }]));
    fpl.getEntryPicks.mockResolvedValue(squadPicks(10));
    fpl.getEventLive.mockResolvedValue(
      liveSchema.parse({ elements: [{ id: 10, stats: { minutes: 90, total_points: 9 } }] })
    );
    // A Free Hit week transfer that would otherwise reprice Palmer.
    fpl.getEntryTransfers.mockResolvedValue(
      squadTransfers([{ element_in: 11, element_in_cost: 70, element_out: 5, element_out_cost: 70, entry: 777, event: 11, time: "2026-11-20T00:00:00Z" }])
    );

    const data = await getEntrySquad(4);
    expect(fpl.getEntryPicks).toHaveBeenCalledWith(4, 10);
    expect(data.gw).toBe(10);
    expect(data.freeHitFallback).toBe(true);
    expect(data.squad.find((player) => player.webName === "Palmer")?.purchaseCost).toBe(100);
    // Points come from that week's live data, not from bootstrap's current-week field.
    expect(data.squad.find((player) => player.webName === "Saka")?.eventPoints).toBe(9);
    expect(data.squad.find((player) => player.webName === "Keeper")?.eventPoints).toBe(0);
  });

  it("looks up the price a late joiner paid for players he never transferred in", async () => {
    fpl.getEntry.mockResolvedValue(squadEntry({ started_event: 5 }));
    fpl.getElementSummary.mockImplementation(async (id: number) =>
      elementSummarySchema.parse({ history: [{ round: 4, total_points: 1, value: 1 }, { round: 5, total_points: 2, value: id === 10 ? 90 : 45 }] })
    );

    const data = await getEntrySquad(5);
    // Palmer and Bench Guy have transfer records; only Saka and Keeper are looked up.
    expect(fpl.getElementSummary.mock.calls.map((call) => call[0]).sort()).toEqual([10, 13]);
    expect(data.squad.find((player) => player.webName === "Saka")?.purchaseCost).toBe(90);
    expect(data.squadSellingValue).not.toBeNull();
  });
});
