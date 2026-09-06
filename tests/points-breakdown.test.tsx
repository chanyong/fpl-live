import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PointsBreakdown } from "@/components/points-breakdown";
import type { PlayerPointsResponse } from "@/lib/types";

const haaland: PlayerPointsResponse = {
  elementId: 411,
  gw: 3,
  webName: "Haaland",
  teamShortName: "MCI",
  position: "FWD",
  confirmedPoints: 6,
  provisionalBonus: 3,
  points: 9,
  fixtures: [
    {
      fixtureId: 26,
      opponent: "COV",
      home: true,
      kickoffTime: "2026-09-05T14:00:00Z",
      started: true,
      settled: false,
      minutes: 90,
      lines: [
        { identifier: "minutes", label: "출전 시간", value: 90, points: 2 },
        { identifier: "goals_scored", label: "득점", value: 1, points: 4 }
      ],
      provisionalBonus: 3,
      points: 9
    }
  ]
};

function renderWith(payload: PlayerPointsResponse, multiplier?: number) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => payload }) as unknown as Response)
  );

  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={client}>
      <PointsBreakdown elementId={payload.elementId} gw={payload.gw} multiplier={multiplier} />
    </QueryClientProvider>
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("PointsBreakdown", () => {
  it("lists every scoring line with its record and its points", async () => {
    renderWith(haaland);

    expect(await screen.findByText("출전 시간")).toBeInTheDocument();
    // Once in the fixture header, once as the figure the two minutes points came from.
    expect(screen.getAllByText("90분")).toHaveLength(2);
    expect(screen.getByText("득점")).toBeInTheDocument();
    expect(screen.getByText("1골")).toBeInTheDocument();
    expect(screen.getByText("+4")).toBeInTheDocument();
  });

  it("marks an unconfirmed bonus as provisional rather than passing it off as final", async () => {
    renderWith(haaland);

    expect(await screen.findByText("잠정")).toBeInTheDocument();
    expect(screen.getByText("BPS 예상")).toBeInTheDocument();
    expect(screen.getByText("GW3 합계")).toBeInTheDocument();
    expect(screen.getByText("9점")).toBeInTheDocument();
  });

  it("applies the captain multiplier once, at the bottom", async () => {
    renderWith(haaland, 2);

    expect(await screen.findByText("주장 ×2 적용")).toBeInTheDocument();
    expect(screen.getByText("18점")).toBeInTheDocument();
  });

  it("says nothing about bonus once FPL has confirmed the score", async () => {
    const settled: PlayerPointsResponse = {
      ...haaland,
      confirmedPoints: 9,
      provisionalBonus: 0,
      fixtures: [
        {
          ...haaland.fixtures[0],
          settled: true,
          provisionalBonus: 0,
          lines: [
            ...haaland.fixtures[0].lines,
            { identifier: "bonus", label: "보너스", value: 3, points: 3 }
          ]
        }
      ]
    };

    renderWith(settled);

    expect(await screen.findByText("보너스")).toBeInTheDocument();
    expect(screen.queryByText("잠정")).not.toBeInTheDocument();
    expect(screen.getByText("종료")).toBeInTheDocument();
  });
});
