import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const store = {
  getUser: vi.fn(async (token: string) => (token === "good" ? { id: "u1", email: "a@b.co" } : null)),
  getProfile: vi.fn(async () => ({ teamId: 7 })),
  listSnapshots: vi.fn(async () => []),
  listNotes: vi.fn(async () => []),
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

  it("notes rejects anonymous, cross-origin and invalid writes", async () => {
    const body = { gw: 1, review: "ok" };
    expect((await notes(req("/api/journal/notes", { method: "PUT", body }))).status).toBe(401);
    const crossSite = await notes(
      req("/api/journal/notes", { method: "PUT", cookie: "good", body, headers: { origin: "http://evil.example" } })
    );
    expect(crossSite.status).toBe(403);
    expect((await notes(req("/api/journal/notes", { method: "PUT", cookie: "good", body: { gw: 99 } }))).status).toBe(400);
    expect((await notes(req("/api/journal/notes", { method: "PUT", cookie: "good", body }))).status).toBe(200);
    expect(store.saveNotes).toHaveBeenCalledTimes(1);
  });

  it("snapshot endpoint requires the cron secret", async () => {
    vi.stubEnv("JOURNAL_CRON_SECRET", "test-secret");
    expect((await snapshot(req("/api/journal/snapshot", { method: "POST" }))).status).toBe(401);
    const wrong = await snapshot(req("/api/journal/snapshot", { method: "POST", headers: { "x-cron-secret": "nope" } }));
    expect(wrong.status).toBe(401);
  });
});
