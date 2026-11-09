import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "@/components/locale-provider";
import { JournalPage } from "@/components/journal-page";

function snapshot(gw: number) {
  return {
    gw,
    points: 50,
    totalPoints: 300,
    overallRank: 1000,
    transfers: 0,
    transferCost: 0,
    benchPoints: 3,
    chip: null,
    captain: 1,
    starters: [],
    bench: [],
    fixtures: []
  };
}

function open(search: string, status: number, body: unknown) {
  window.history.replaceState(null, "", `/journal${search}`);
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), { status })));
  return render(
    <LocaleProvider>
      <JournalPage />
    </LocaleProvider>
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

describe("journal opened from a league page (?gw=N)", () => {
  it("highlights the requested week and focuses its first field", async () => {
    open("?gw=2", 200, {
      email: "a@b.co",
      teamId: 100,
      snapshots: [{ gw: 3, snapshot: snapshot(3) }, { gw: 2, snapshot: snapshot(2) }],
      notes: []
    });
    await waitFor(() => expect(document.getElementById("gw-2")).not.toBeNull());
    const card = document.getElementById("gw-2")!;
    expect(card.className).toContain("ring-2");
    expect(document.getElementById("gw-3")!.className).not.toContain("ring-2");
    await waitFor(() => expect(document.activeElement).toBe(card.querySelector("textarea")));
  });

  it("says so when that week is not saved yet", async () => {
    open("?gw=9", 200, { email: "a@b.co", teamId: 100, snapshots: [{ gw: 3, snapshot: snapshot(3) }], notes: [] });
    expect((await screen.findByText(/GW9 일지는 게임위크가 끝나고/)).textContent).toContain("자동 저장");
  });

  it("tells a visitor who is not signed in where login leads", async () => {
    open("?gw=4", 401, { error: "unauthorized" });
    expect(await screen.findByText("로그인하면 GW4 일지로 이동합니다.")).toBeTruthy();
  });

  it("ignores a bad gw value", async () => {
    open("?gw=99", 200, { email: "a@b.co", teamId: 100, snapshots: [{ gw: 3, snapshot: snapshot(3) }], notes: [] });
    await waitFor(() => expect(document.getElementById("gw-3")).not.toBeNull());
    expect(screen.queryByText(/일지는 게임위크가 끝나고/)).toBeNull();
  });
});
