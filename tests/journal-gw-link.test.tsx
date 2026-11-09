import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { JournalGwLink } from "@/components/journal-gw-link";
import { LocaleProvider } from "@/components/locale-provider";
import { hasWrittenNotes, journalGwHref, parseJournalGw, resolveJournalGwLink, type JournalAccess } from "@/lib/journal/gw-link";

const member = (overrides: Partial<Extract<JournalAccess, { kind: "member" }>> = {}): JournalAccess => ({
  kind: "member",
  teamId: 100,
  savedGws: [1, 2, 3],
  writtenGws: [2],
  ...overrides
});
const base = { currentGw: 5, leagueEntryIds: [100, 200] };

describe("resolveJournalGwLink", () => {
  it("builds the journal address from the gameweek", () => {
    expect(journalGwHref(12)).toBe("/journal?gw=12");
  });

  it("sends a guest to log in on the same gameweek", () => {
    expect(resolveJournalGwLink({ ...base, gw: 3, access: { kind: "guest" } })).toEqual({ kind: "login", href: "/journal?gw=3" });
  });

  it("offers write for an unwritten saved week and view for a written one", () => {
    expect(resolveJournalGwLink({ ...base, gw: 1, access: member() })).toEqual({ kind: "write", href: "/journal?gw=1" });
    expect(resolveJournalGwLink({ ...base, gw: 2, access: member() })).toEqual({ kind: "view", href: "/journal?gw=2" });
  });

  it("marks a week with no saved snapshot as pending instead of linking to nothing", () => {
    expect(resolveJournalGwLink({ ...base, gw: 5, access: member() })).toEqual({ kind: "pending" });
  });

  it("hides the link for a team that is not in this league, or a member without a team", () => {
    expect(resolveJournalGwLink({ ...base, gw: 1, access: member({ teamId: 999 }) })).toEqual({ kind: "hidden" });
    expect(resolveJournalGwLink({ ...base, gw: 1, access: member({ teamId: null }) })).toEqual({ kind: "hidden" });
  });

  it("never links a gameweek that has not started, or when the journal is unavailable", () => {
    expect(resolveJournalGwLink({ ...base, gw: 6, access: { kind: "guest" } })).toEqual({ kind: "hidden" });
    expect(resolveJournalGwLink({ ...base, gw: 0, access: { kind: "guest" } })).toEqual({ kind: "hidden" });
    expect(resolveJournalGwLink({ ...base, gw: 3, access: { kind: "unavailable" } })).toEqual({ kind: "hidden" });
  });
});

describe("parseJournalGw and hasWrittenNotes", () => {
  it("accepts only whole gameweeks 1 to 38", () => {
    expect(parseJournalGw("?gw=12")).toBe(12);
    expect(parseJournalGw("?gw=38")).toBe(38);
    for (const bad of ["", "?gw=0", "?gw=39", "?gw=abc", "?gw=1.5", "?gw=-3", "?gw=007"]) {
      expect(parseJournalGw(bad)).toBeNull();
    }
  });

  it("treats whitespace-only notes as not written", () => {
    const empty = { review: " ", good: "", bad: "\n", plan: "", principles: "" };
    expect(hasWrittenNotes(empty)).toBe(false);
    expect(hasWrittenNotes({ ...empty, plan: "buy Salah" })).toBe(true);
  });
});

function renderLink(gw = 3) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <LocaleProvider>
        <JournalGwLink gw={gw} currentGw={5} leagueEntryIds={[100, 200]} />
      </LocaleProvider>
    </QueryClientProvider>
  );
}

function mockEntries(status: number, body: unknown = {}) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), { status })));
}

afterEach(() => vi.unstubAllGlobals());

describe("JournalGwLink", () => {
  it("shows a login link to a visitor who is not signed in", async () => {
    mockEntries(401, { error: "unauthorized" });
    renderLink(3);
    const link = await screen.findByRole("link", { name: /로그인 후 일지 쓰기/ });
    expect(link.getAttribute("href")).toBe("/journal?gw=3");
  });

  it("shows write for a saved week without notes", async () => {
    mockEntries(200, {
      teamId: 100,
      snapshots: [{ gw: 3 }, { gw: 4 }],
      notes: [{ gw: 4, review: "good week", good: "", bad: "", plan: "", principles: "" }]
    });
    renderLink(3);
    expect((await screen.findByRole("link", { name: /일지 쓰기/ })).getAttribute("href")).toBe("/journal?gw=3");
  });

  it("shows view for a written week", async () => {
    mockEntries(200, {
      teamId: 100,
      snapshots: [{ gw: 4 }],
      notes: [{ gw: 4, review: "good week", good: "", bad: "", plan: "", principles: "" }]
    });
    renderLink(4);
    expect((await screen.findByRole("link", { name: /일지 보기/ })).getAttribute("href")).toBe("/journal?gw=4");
  });

  it("renders nothing for a member whose team is in another league", async () => {
    mockEntries(200, { teamId: 999, snapshots: [{ gw: 3 }], notes: [] });
    const { container } = renderLink(3);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(container.textContent).toBe("");
  });

  it("renders nothing when the journal service is not configured", async () => {
    mockEntries(503, { error: "not_configured" });
    const { container } = renderLink(3);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(container.textContent).toBe("");
  });
});
