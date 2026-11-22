import { beforeEach, describe, expect, it } from "vitest";
import { checkEntryRequest, entryRequestLimitSize, resetEntryRequestLimits } from "@/lib/entry-request-limit";
import { parseEntryId } from "@/lib/request-params";

// Issue #39 stage 2: a brake on walking through team IDs, and strict ID parsing in front of the FPL URL.
beforeEach(resetEntryRequestLimits);

describe("checkEntryRequest", () => {
  it("allows 20 requests a minute per IP, then asks to wait", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 20; i += 1) {
      expect(checkEntryRequest("1.1.1.1", 5, false, t0 + i).allowed).toBe(true);
    }
    const blocked = checkEntryRequest("1.1.1.1", 5, false, t0 + 21);
    expect(blocked.allowed).toBe(false);
    if (!blocked.allowed) expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    // Another IP is not affected, and a minute later the first one is free again.
    expect(checkEntryRequest("2.2.2.2", 5, false, t0 + 21).allowed).toBe(true);
    expect(checkEntryRequest("1.1.1.1", 5, false, t0 + 61_000).allowed).toBe(true);
  });

  it("stops one IP from walking through more than 12 different team IDs in 10 minutes", () => {
    const t0 = 1_000_000;
    for (let id = 1; id <= 12; id += 1) {
      expect(checkEntryRequest("1.1.1.1", id, false, t0 + id * 4_000).allowed).toBe(true);
    }
    expect(checkEntryRequest("1.1.1.1", 13, false, t0 + 60_000).allowed).toBe(false);
    // Looking at a team already seen is still fine.
    expect(checkEntryRequest("1.1.1.1", 3, false, t0 + 90_000).allowed).toBe(true);
    // Ten minutes on, the window has moved.
    expect(checkEntryRequest("1.1.1.1", 13, false, t0 + 11 * 60_000).allowed).toBe(true);
  });

  it("lets one team be force-refreshed only every 30 seconds", () => {
    const t0 = 1_000_000;
    expect(checkEntryRequest("1.1.1.1", 7, true, t0).allowed).toBe(true);
    expect(checkEntryRequest("1.1.1.1", 7, true, t0 + 10_000).allowed).toBe(false);
    expect(checkEntryRequest("1.1.1.1", 7, false, t0 + 10_000).allowed).toBe(true);
    expect(checkEntryRequest("1.1.1.1", 7, true, t0 + 31_000).allowed).toBe(true);
  });
});

describe("limiter memory", () => {
  it("forgets visitors who do not come back, well below any size cap", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 50; i += 1) {
      checkEntryRequest(`10.0.0.${i}`, i + 1, true, t0);
    }
    expect(entryRequestLimitSize()).toBe(150);
    // One request 11 minutes later sweeps everything that expired.
    checkEntryRequest("9.9.9.9", 1, false, t0 + 11 * 60_000);
    expect(entryRequestLimitSize()).toBe(2);
  });

  it("keeps each map under a hard cap by dropping the oldest keys, even inside the window", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 2500; i += 1) {
      checkEntryRequest(`ip-${i}`, 1, false, t0 + i);
    }
    expect(entryRequestLimitSize()).toBeLessThanOrEqual(2 * 2001);
  });
});

describe("parseEntryId", () => {
  it("accepts plain positive integers", () => {
    expect(parseEntryId("4300767")).toEqual({ entryId: 4300767 });
  });

  it.each([null, "", "0", "-5", "1.5", "1e3", "0x10", " 12", "12 ", "abc", "12345678901", "../api", "2000000001"])(
    "rejects %j before it can reach the FPL URL",
    (raw) => {
      expect("error" in parseEntryId(raw)).toBe(true);
    }
  );
});
