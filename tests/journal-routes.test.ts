import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const store = {
  getUser: vi.fn(async (token: string) => (token === "good" ? { id: "u1", email: "a@b.co" } : null)),
  getProfile: vi.fn(async () => ({ teamId: 7 })),
  listSnapshots: vi.fn(async () => [] as unknown[]),
  listNotes: vi.fn(async () => [] as unknown[]),
  saveNotes: vi.fn(async () => {})
};
vi.mock("@/lib/journal/session", async (importActual) => ({
  ...(await importActual<typeof import("@/lib/journal/session")>()),
  requireStore: () => store
}));

import { GET as entries } from "@/app/api/journal/entries/route";
import { PUT as notes } from "@/app/api/journal/notes/route";
import { POST as snapshot } from "@/app/api/journal/snapshot/route";
import { SESSION_COOKIE } from "@/lib/journal/session";

const req = (
  url: string,
  init: { method?: string; cookie?: string; headers?: Record<string, string>; body?: unknown } = {}
) =>
  new NextRequest(`http://localhost${url}`, {
    method: init.method ?? "GET",
    headers: { ...(init.cookie ? { cookie: `${SESSION_COOKIE}=${init.cookie}` } : {}), ...init.headers },
    body: init.body === undefined ? undefined : JSON.stringify(init.body)
  });

afterEach(() => vi.unstubAllEnvs());

describe("journal API auth", () => {
  it("entries needs a valid session", async () => {
    expect((await entries(req("/api/journal/entries"))).status).toBe(401);
    expect((await entries(req("/api/journal/entries", { cookie: "bad" }))).status).toBe(401);
    const ok = await entries(req("/api/journal/entries", { cookie: "good" }));
    expect(ok.status).toBe(200);
    expect(ok.headers.get("cache-control")).toContain("no-store");
  });

  it("entries answers 502 instead of an empty journal when a read fails", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    store.listNotes.mockRejectedValueOnce(new Error("notes read failed (500)"));
    const response = await entries(req("/api/journal/entries", { cookie: "good" }));
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "load_failed" });
    spy.mockRestore();
  });

  it("accepts the production origin behind the proxy and rejects others", async () => {
    const body = { gw: 1, review: "ok" };
    const behindProxy = (origin: string) =>
      notes(
        req("/api/journal/notes", {
          method: "PUT",
          cookie: "good",
          body,
          headers: { origin, host: "localhost:8080", "x-forwarded-host": "fpl.example.com", "x-forwarded-proto": "https" }
        })
      );
    expect((await behindProxy("https://fpl.example.com")).status).toBe(200);
    expect((await behindProxy("https://evil.example")).status).toBe(403);
  });

  it("without an Origin header only same-origin fetches pass", async () => {
    const body = { gw: 1, review: "ok" };
    const withSite = (site?: string) =>
      notes(req("/api/journal/notes", { method: "PUT", cookie: "good", body, headers: site ? { "sec-fetch-site": site } : {} }));
    expect((await withSite("same-origin")).status).toBe(200);
    expect((await withSite("cross-site")).status).toBe(403);
    expect((await withSite()).status).toBe(403);
  });

  it("notes rejects anonymous, cross-origin and invalid writes", async () => {
    const body = { gw: 1, review: "ok" };
    const sameSite = { "sec-fetch-site": "same-origin" };
    expect((await notes(req("/api/journal/notes", { method: "PUT", body, headers: sameSite }))).status).toBe(401);
    const crossSite = await notes(
      req("/api/journal/notes", { method: "PUT", cookie: "good", body, headers: { origin: "http://evil.example" } })
    );
    expect(crossSite.status).toBe(403);
    expect((await notes(req("/api/journal/notes", { method: "PUT", cookie: "good", body: { gw: 99 }, headers: sameSite }))).status).toBe(400);
    expect((await notes(req("/api/journal/notes", { method: "PUT", cookie: "good", body, headers: sameSite }))).status).toBe(200);
  });

  it("snapshot endpoint requires the cron secret", async () => {
    vi.stubEnv("JOURNAL_CRON_SECRET", "test-secret");
    expect((await snapshot(req("/api/journal/snapshot", { method: "POST" }))).status).toBe(401);
    const wrong = await snapshot(req("/api/journal/snapshot", { method: "POST", headers: { "x-cron-secret": "nope" } }));
    expect(wrong.status).toBe(401);
  });
});
