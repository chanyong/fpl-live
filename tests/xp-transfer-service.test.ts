import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getEntrySquad = vi.hoisted(() => vi.fn());
const getXpTable = vi.hoisted(() => vi.fn());
const searchSpy = vi.hoisted(() => vi.fn());
vi.mock("@/lib/entry-squad", async (importActual) => ({
  ...(await importActual<typeof import("@/lib/entry-squad")>()),
  getEntrySquad
}));
vi.mock("@/lib/xp/xp-table", () => ({ getXpTable, resetXpTableCache: () => undefined }));
// Issue #47: these tests are about what the route computes, not who may ask. The own-team guard has its own tests
// (tests/own-team-guard.test.ts), so here it lets the request through.
vi.mock("@/lib/journal/own-team", async (importActual) => ({
  ...(await importActual<typeof import("@/lib/journal/own-team")>()),
  checkOwnTeam: async () => "ok"
}));
vi.mock("@/lib/xp/transfer-search", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/xp/transfer-search")>();
  searchSpy.mockImplementation(actual.searchTransfers);
  return { ...actual, searchTransfers: searchSpy };
});

import { GET } from "@/app/api/entry-recommend/route";
import { resetEntryRequestLimits } from "@/lib/entry-request-limit";
import { EntryBusyError } from "@/lib/entry-squad";
import type { ChipStatus } from "@/lib/chip-availability";
import type { EntrySquadPayload } from "@/lib/squad-types";
import { searchTransfers } from "@/lib/xp/transfer-search";
import {
  getTransfers,
  MAX_CONCURRENT_SEARCHES,
  resetTransferCache,
  toTransferInput,
  TRANSFER_CACHE_MAX_ENTRIES,
  TRANSFER_CACHE_TTL_MS,
  transferCacheSize
} from "@/lib/xp/transfer-service";
import { baseSquadSpecs, mkTable, OWN_IDS, type Spec } from "./helpers/xp-transfer";

// Issue #43 stage 1-B: the per-team cache, the 2-search limit and the route's horizon parameter.
const specs: Spec[] = [...baseSquadSpecs({ 21: 0 }), { id: 41, type: 3, team: 41, cost: 50, xp: 6 }];

const chip = (name: string, state: ChipStatus["state"]): ChipStatus => ({ name, startEvent: 2, stopEvent: 19, state });

const squadPayload = (entryId: number, fetchedAt = 5_000, extra: Partial<EntrySquadPayload> = {}): EntrySquadPayload =>
  ({
    entryId,
    teamName: "Test FC",
    managerName: "A B",
    gw: 11,
    bank: 0,
    squad: OWN_IDS.map((id, index) => ({
      elementId: id,
      webName: `P${id}`,
      teamShortName: "ARS",
      position: ({ 1: "GKP", 2: "DEF", 3: "MID", 4: "FWD" } as const)[specs.find((spec) => spec.id === id)!.type as 1 | 2 | 3 | 4],
      pickPosition: index + 1,
      isStarter: index < 11,
      status: "a",
      nowCost: 50,
      sellingPrice: 50
    })),
    chips: [chip("wildcard", { kind: "available" }), chip("freehit", { kind: "used", event: 4 })],
    transfers: { freeTransfers: 1, freeTransfersMatchHistory: true, lastGwTransfers: 0, lastGwCost: 0, pendingTransfers: 0 },
    fetchedAt,
    ...extra
  }) as unknown as EntrySquadPayload;

const table = (builtAt = 1_000) => mkTable(specs, undefined, builtAt);

beforeEach(async () => {
  resetTransferCache();
  const actual = await vi.importActual<typeof import("@/lib/xp/transfer-search")>("@/lib/xp/transfer-search");
  searchSpy.mockReset().mockImplementation(actual.searchTransfers);
});

describe("toTransferInput", () => {
  it("reads selling prices, bank, free transfers and chips from the squad payload", () => {
    const input = toTransferInput(squadPayload(1, 5_000, { bank: 7 }), table(), 5)!;
    expect(input).toMatchObject({ bank: 7, freeTransfers: 1, horizon: 5, freeTransfersUnreliable: false });
    expect(input.squad).toHaveLength(15);
    expect(input.chips).toEqual({ wildcard: { available: true }, freehit: { available: false, reason: "chip_used" } });
  });

  it("is null for a team without a full squad or with a player the xP table does not know", () => {
    expect(toTransferInput(squadPayload(1, 5_000, { squad: [] }), table(), 3)).toBeNull();
    const missing = mkTable(specs.filter((spec) => spec.id !== 33));
    expect(toTransferInput(squadPayload(1), missing, 3)).toBeNull();
  });
});

describe("getTransfers cache", () => {
  it("searches once per (entry, xP table, squad load, horizon) for five minutes", async () => {
    const first = await getTransfers(squadPayload(1), table(), 3);
    expect(first!.recommendedId).toBe("one:21>41");
    expect(await getTransfers(squadPayload(1), table(), 3)).toBe(first);
    expect(searchSpy).toHaveBeenCalledTimes(1);

    await getTransfers(squadPayload(1), table(), 5);
    expect(searchSpy).toHaveBeenCalledTimes(2);
    await getTransfers(squadPayload(1), table(2_000), 3);
    expect(searchSpy).toHaveBeenCalledTimes(3);
    await getTransfers(squadPayload(1, 6_000), table(), 3);
    expect(searchSpy).toHaveBeenCalledTimes(4);
    await getTransfers(squadPayload(2), table(), 3);
    expect(searchSpy).toHaveBeenCalledTimes(5);

    // After the TTL the same key is searched again.
    await getTransfers(squadPayload(1), table(), 3, Date.now() + TRANSFER_CACHE_TTL_MS + 1_000);
    expect(searchSpy).toHaveBeenCalledTimes(6);
  });

  it("answers null without searching for a team with no full squad", async () => {
    expect(await getTransfers(squadPayload(1, 5_000, { squad: [] }), table(), 3)).toBeNull();
    expect(searchSpy).not.toHaveBeenCalled();
  });

  it("lets concurrent requests for the same key share one search", async () => {
    const [a, b, c] = await Promise.all([getTransfers(squadPayload(1), table(), 3), getTransfers(squadPayload(1), table(), 3), getTransfers(squadPayload(1), table(), 3)]);
    expect(searchSpy).toHaveBeenCalledTimes(1);
    expect(b).toBe(a);
    expect(c).toBe(a);
  });

  it("keeps at most 200 results, dropping the oldest", async () => {
    for (let id = 1; id <= TRANSFER_CACHE_MAX_ENTRIES + 5; id += 1) {
      await getTransfers(squadPayload(id), table(), 3);
    }
    expect(transferCacheSize()).toBe(TRANSFER_CACHE_MAX_ENTRIES);
    searchSpy.mockClear();
    await getTransfers(squadPayload(1), table(), 3); // evicted: searched again
    expect(searchSpy).toHaveBeenCalledTimes(1);
  });
});

/** Replaces the search by one that waits for `release()`. */
function gatedSearch() {
  const gates: Array<() => void> = [];
  searchSpy.mockImplementation(async (...args: Parameters<typeof searchTransfers>) => {
    const actual = await vi.importActual<typeof import("@/lib/xp/transfer-search")>("@/lib/xp/transfer-search");
    await new Promise<void>((resolve) => gates.push(resolve));
    return actual.searchTransfers(...args);
  });
  return { release: () => gates.splice(0).forEach((open) => open()), waiting: () => gates.length };
}

describe("concurrent search limit", () => {
  it("refuses a third search with EntryBusyError and accepts one again after the others finish", async () => {
    expect(MAX_CONCURRENT_SEARCHES).toBe(2);
    const gate = gatedSearch();
    const first = getTransfers(squadPayload(1), table(), 3);
    const second = getTransfers(squadPayload(2), table(), 3);
    await expect(getTransfers(squadPayload(3), table(), 3)).rejects.toBeInstanceOf(EntryBusyError);
    // The same key as a running search shares it instead of being refused.
    const shared = getTransfers(squadPayload(1), table(), 3);

    await vi.waitFor(() => expect(gate.waiting()).toBe(2));
    gate.release();
    await Promise.all([first, second, shared]);
    const third = getTransfers(squadPayload(3), table(), 3);
    await vi.waitFor(() => expect(gate.waiting()).toBe(1));
    gate.release();
    await expect(third).resolves.not.toBeNull();
  });

  it("does not keep a slot when the search throws", async () => {
    searchSpy.mockImplementationOnce(async () => {
      throw new Error("boom");
    });
    searchSpy.mockImplementationOnce(async () => {
      throw new Error("boom");
    });
    await expect(getTransfers(squadPayload(1), table(), 3)).rejects.toThrow("boom");
    await expect(getTransfers(squadPayload(2), table(), 3)).rejects.toThrow("boom");
    await expect(getTransfers(squadPayload(3), table(), 3)).resolves.not.toBeNull();
  });
});

describe("GET /api/entry-recommend transfers and horizon", () => {
  const req = (query: string, ip = "9.9.9.9") => new NextRequest(`http://localhost/api/entry-recommend${query}`, { headers: { "x-forwarded-for": ip } });

  beforeEach(() => {
    resetEntryRequestLimits();
    getEntrySquad.mockReset().mockImplementation(async (entryId: number) => squadPayload(entryId));
    getXpTable.mockReset().mockResolvedValue(table());
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("answers 400 for a horizon other than 3 or 5, before loading anything", async () => {
    for (const query of ["&horizon=0", "&horizon=1", "&horizon=4", "&horizon=6", "&horizon=abc", "&horizon=", "&horizon=3.0", "&horizon=05"]) {
      expect((await GET(req(`?entryId=5${query}`))).status, query).toBe(400);
    }
    expect(getEntrySquad).not.toHaveBeenCalled();
  });

  it("adds the transfer scenarios, three weeks by default and five on request", async () => {
    const defaultBody = await (await GET(req("?entryId=5"))).json();
    expect(defaultBody.transfers).toMatchObject({ horizon: 3, recommendedId: "one:21>41", freeTransfers: 1 });
    expect(defaultBody.transfers.scenarios[0].id).toBe("roll");
    expect(defaultBody.transfers.scenarios.map((scenario: { type: string }) => scenario.type)).toContain("wildcard");
    expect(defaultBody.transfers.skipped).toEqual([{ type: "freehit", reason: "chip_used" }]);
    expect(defaultBody.transfers.estimates).toEqual({ sellingPriceFallback: false, freeTransfersFallback: false, freeTransfersUnreliable: false });
    expect(defaultBody.transfers.poolSize).toBe(1);

    const fiveBody = await (await GET(req("?entryId=5&horizon=5"))).json();
    expect(fiveBody.transfers.horizon).toBe(5);
    expect(fiveBody.transfers.gws).toHaveLength(5);
    // Lineup and captain parts are the same as before.
    expect(fiveBody.lineups).toEqual(defaultBody.lineups);
    expect(fiveBody.captains).toEqual(defaultBody.captains);
  });

  it("reuses the cached search for the same team and horizon", async () => {
    await GET(req("?entryId=5"));
    await GET(req("?entryId=5"));
    expect(searchSpy).toHaveBeenCalledTimes(1);
  });

  it("answers 503 with Retry-After when two searches are already running", async () => {
    const gate = gatedSearch();
    const one = GET(req("?entryId=11", "1.1.1.1"));
    const two = GET(req("?entryId=12", "2.2.2.2"));
    await vi.waitFor(() => expect(gate.waiting()).toBe(2));

    const refused = await GET(req("?entryId=13", "3.3.3.3"));
    expect(refused.status).toBe(503);
    expect(refused.headers.get("retry-after")).toBe("2");
    expect(await refused.json()).toMatchObject({ retryAfterSeconds: 2 });

    gate.release();
    expect((await one).status).toBe(200);
    expect((await two).status).toBe(200);
  });

  it("has transfers null for a team with no squad yet", async () => {
    getEntrySquad.mockResolvedValueOnce(squadPayload(5, 5_000, { gw: null, squad: [] }));
    const body = await (await GET(req("?entryId=5"))).json();
    expect(body.transfers).toBeNull();
    expect(body.lineups).toEqual([]);
  });
});
