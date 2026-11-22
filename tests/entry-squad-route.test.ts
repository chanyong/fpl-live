import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getEntrySquad = vi.hoisted(() => vi.fn());
vi.mock("@/lib/entry-squad", async (importActual) => ({
  ...(await importActual<typeof import("@/lib/entry-squad")>()),
  getEntrySquad
}));

import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { GET } from "@/app/api/entry-squad/route";
import { resetEntryRequestLimits } from "@/lib/entry-request-limit";
import { EntryBusyError, EntryNotFoundError, FplUnavailableError } from "@/lib/entry-squad";

// Issue #39 stage 2: the personal-squad API validates, limits and maps errors; team screens stay out of search.
const req = (query: string, ip = "9.9.9.9") =>
  new NextRequest(`http://localhost/api/entry-squad${query}`, { headers: { "x-forwarded-for": ip } });

beforeEach(() => {
  resetEntryRequestLimits();
  getEntrySquad.mockReset().mockResolvedValue({ entryId: 5, teamName: "Test FC" });
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("GET /api/entry-squad", () => {
  it("answers 400 for a missing or malformed team ID without calling FPL", async () => {
    for (const query of ["", "?entryId=abc", "?entryId=-1", "?entryId=1e3", "?entryId=../x"]) {
      const response = await GET(req(query));
      expect(response.status).toBe(400);
    }
    expect(getEntrySquad).not.toHaveBeenCalled();
  });

  it("returns the squad uncached for browsers", async () => {
    const response = await GET(req("?entryId=5"));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toMatchObject({ teamName: "Test FC" });
    expect(getEntrySquad).toHaveBeenCalledWith(5, false);
  });

  it("passes refresh=1 on as a forced refresh", async () => {
    await GET(req("?entryId=5&refresh=1"));
    expect(getEntrySquad).toHaveBeenCalledWith(5, true);
  });

  it("maps an unknown team to 404 and an FPL outage to 502", async () => {
    getEntrySquad.mockRejectedValueOnce(new EntryNotFoundError());
    expect((await GET(req("?entryId=6"))).status).toBe(404);
    getEntrySquad.mockRejectedValueOnce(new FplUnavailableError());
    expect((await GET(req("?entryId=7"))).status).toBe(502);
    getEntrySquad.mockRejectedValueOnce(new Error("boom"));
    expect((await GET(req("?entryId=8"))).status).toBe(500);
  });

  it("stops an IP that walks through team IDs with 429 and Retry-After", async () => {
    for (let id = 1; id <= 12; id += 1) {
      expect((await GET(req(`?entryId=${id}`))).status).toBe(200);
    }
    const blocked = await GET(req("?entryId=13"));
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get("retry-after"))).toBeGreaterThan(0);
    // Another visitor is not affected.
    expect((await GET(req("?entryId=13", "8.8.8.8"))).status).toBe(200);
  });

  it("counts by the proxy's x-real-ip, so a changing x-forwarded-for does not reset the limit", async () => {
    const forged = (id: number) =>
      new NextRequest(`http://localhost/api/entry-squad?entryId=${id}`, {
        headers: { "x-real-ip": "7.7.7.7", "x-forwarded-for": `10.0.0.${id}` }
      });
    for (let id = 1; id <= 12; id += 1) {
      expect((await GET(forged(id))).status).toBe(200);
    }
    expect((await GET(forged(13))).status).toBe(429);
  });

  it("answers 503 with Retry-After when too many teams are being loaded at once", async () => {
    getEntrySquad.mockRejectedValueOnce(new EntryBusyError(5));
    const response = await GET(req("?entryId=9"));
    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("5");
    expect(await response.json()).toMatchObject({ retryAfterSeconds: 5 });
  });
});

describe("personal team screens in search", () => {
  it("are disallowed in robots.txt and absent from the sitemap", () => {
    const rules = robots().rules;
    const disallow = ([] as Array<{ disallow?: string | string[] }>).concat(rules).flatMap((rule) => rule.disallow ?? []);
    expect(disallow).toContain("/team/");
    expect(sitemap().some((item) => item.url.includes("/team"))).toBe(false);
  });
});
