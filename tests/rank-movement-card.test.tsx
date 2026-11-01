import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RankMovementCard } from "@/components/rank-movement-card";
import type { LeagueFixture } from "@/lib/types";

// The title is the only place the card says whether its ranks are still provisional (#8 review).
function fixture(started: boolean, finished: boolean): LeagueFixture {
  return { started, finished, finishedProvisional: finished } as unknown as LeagueFixture;
}

describe("RankMovementCard title", () => {
  it("marks the ranks as provisional while matches are still to finish", () => {
    render(<RankMovementCard rows={[]} fixtures={[fixture(true, true), fixture(true, false)]} gw={10} />);

    expect(screen.getByRole("heading", { name: "GW 10 순위 변화 (잠정)" })).toBeInTheDocument();
  });

  it("drops the provisional mark once every match has finished", () => {
    render(<RankMovementCard rows={[]} fixtures={[fixture(true, true), fixture(true, true)]} gw={10} />);

    expect(screen.getByRole("heading", { name: "GW 10 순위 변화" })).toBeInTheDocument();
  });
});
