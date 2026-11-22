import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bootstrapFixture, fixturesFixture } from "./helpers/public-fpl";

const getBootstrapStatic = vi.fn();
const getFixtures = vi.fn();
vi.mock("@/lib/fpl-client", () => ({ getBootstrapStatic: () => getBootstrapStatic(), getFixtures: () => getFixtures() }));

import { getPublicFootball, getPublicPlayers, resetPublicDataCache } from "@/lib/public-data";

// Issue #33 stage 2: the public pages must come up, with a notice at worst, whatever FPL does.
const BOOTSTRAP = bootstrapFixture([{ id: 1, is_current: true }]);
const FIXTURES = fixturesFixture([]);

beforeEach(() => {
  resetPublicDataCache();
  getBootstrapStatic.mockReset().mockResolvedValue(BOOTSTRAP);
  getFixtures.mockReset().mockResolvedValue(FIXTURES);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("public data", () => {
  it("asks FPL once for all three pages within a minute", async () => {
    await getPublicFootball();
    await getPublicPlayers();
    await getPublicFootball();
    expect(getBootstrapStatic).toHaveBeenCalledTimes(1);
    expect(getFixtures).toHaveBeenCalledTimes(1);
  });

  it("returns null, not an error, when FPL fails and nothing is cached", async () => {
    getBootstrapStatic.mockRejectedValue(new Error("FPL request failed (503)"));
    await expect(getPublicFootball()).resolves.toBeNull();
    await expect(getPublicPlayers()).resolves.toBeNull();
  });

  it("serves the last good copy when a refresh fails", async () => {
    vi.useFakeTimers();
    await getPublicFootball();
    vi.advanceTimersByTime(61_000);
    getFixtures.mockRejectedValue(new Error("boom"));
    const stale = await getPublicFootball();
    expect(stale).not.toBeNull();
    expect(getFixtures).toHaveBeenCalledTimes(2);
  });

  it("stops waiting after the deadline when FPL hangs", async () => {
    vi.useFakeTimers();
    getBootstrapStatic.mockReturnValue(new Promise(() => undefined));
    const result = getPublicFootball();
    await vi.advanceTimersByTimeAsync(8_100);
    await expect(result).resolves.toBeNull();
  });
});
