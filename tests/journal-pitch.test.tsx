import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { JournalPitch } from "@/components/journal-pitch";
import { LocaleProvider } from "@/components/locale-provider";
import type { SnapshotPlayer, WeeklySnapshot } from "@/lib/journal-snapshot";

const base: WeeklySnapshot = {
  gw: 5,
  points: 61,
  totalPoints: 300,
  overallRank: 1000,
  transfers: 1,
  transferCost: 4,
  benchPoints: 7,
  chip: "3xc",
  captain: 2,
  starters: [],
  bench: [],
  fixtures: [{ id: 9, teamH: 1, teamA: 2, scoreH: 2, scoreA: 1, kickoff: "2026-09-05T14:00:00Z", finished: true }]
};

function player(id: number, slot: number, type: number, name: string, extra: Partial<SnapshotPlayer> = {}): SnapshotPlayer {
  return { id, name, team: "MCI", type, slot, multiplier: slot <= 11 ? 1 : 0, isCaptain: false, isVice: false, points: 2, minutes: 90, fixtures: [], ...extra };
}

describe("JournalPitch", () => {
  it("shows a safe note for snapshots saved before the detail existed", () => {
    render(
      <LocaleProvider>
        <JournalPitch snapshot={base} />
      </LocaleProvider>
    );
    expect(screen.getByText(/상세가 아직 저장되지/)).toBeTruthy();
  });

  it("renders lines, captain points, results, and opens the ledger", () => {
    const snapshot: WeeklySnapshot = {
      ...base,
      average: 50,
      highest: 120,
      gwRank: 5,
      teams: { "1": "MCI", "2": "ARS" },
      players: [
        player(1, 1, 1, "Raya"),
        player(2, 2, 4, "Haaland", {
          multiplier: 3,
          isCaptain: true,
          points: 9,
          fixtures: [{ fixture: 9, stats: [{ id: "minutes", value: 90, points: 2 }, { id: "goals_scored", value: 1, points: 7 }] }]
        }),
        player(12, 12, 1, "Bench GK", { points: 0 })
      ]
    };
    render(
      <LocaleProvider>
        <JournalPitch snapshot={snapshot} />
      </LocaleProvider>
    );
    expect(screen.getByText("(x3)")).toBeTruthy();
    expect(screen.getByText("27")).toBeTruthy();
    expect(screen.getByText("종료")).toBeTruthy();
    expect(screen.getByText("2 - 1")).toBeTruthy();
    expect(screen.getByText("내 선수 1명 보유")).toBeTruthy();
    expect(screen.getByRole("list", { name: "내 선수" }).textContent).toContain("Haaland");
    fireEvent.click(screen.getByRole("button", { name: /Haaland/ }));
    expect(screen.getByText(/x3 = 27/)).toBeTruthy();
  });
});
