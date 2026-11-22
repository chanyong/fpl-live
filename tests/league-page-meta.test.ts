import { describe, expect, it, vi } from "vitest";
import { leagueViewMetadata } from "@/lib/league-page-meta";

vi.mock("@/lib/league-meta", () => ({ getLeagueMeta: async () => ({ name: "Test League", gw: 10 }) }));

// Issue #33: a shared tab link needs the league's share card image, like the plain league address.
describe("leagueViewMetadata share image", () => {
  it.each(["fixtures", "table", "rank-change", "teams", "players"] as const)("names the league share image on the %s tab", async (view) => {
    const meta = await leagueViewMetadata("915874", view);
    expect(meta.openGraph?.images).toEqual([expect.objectContaining({ url: "/league/915874/opengraph-image" })]);
    expect(meta.twitter?.images).toEqual([expect.objectContaining({ url: "/league/915874/opengraph-image" })]);
  });
});
