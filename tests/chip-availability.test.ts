import { describe, expect, it } from "vitest";
import { chipStatuses } from "@/lib/chip-availability";
import { squadBootstrap } from "./helpers/entry-fpl";

// Issue #39 stage 2: eight chips, two windows each (Wildcard and Free Hit start at GW2, the others at GW1).
describe("chipStatuses", () => {
  const windows = squadBootstrap().chips;

  it("marks played chips with their gameweek and the rest available in the open window", () => {
    const statuses = chipStatuses(
      windows,
      [
        { name: "bboost", event: 1 },
        { name: "3xc", event: 3 }
      ],
      12
    );
    const state = (name: string, startEvent: number) =>
      statuses.find((status) => status.name === name && status.startEvent === startEvent)?.state;

    expect(state("bboost", 1)).toEqual({ kind: "used", event: 1 });
    expect(state("3xc", 1)).toEqual({ kind: "used", event: 3 });
    expect(state("wildcard", 2)).toEqual({ kind: "available" });
    expect(state("freehit", 2)).toEqual({ kind: "available" });
    expect(state("wildcard", 20)).toEqual({ kind: "later", startEvent: 20 });
    expect(statuses).toHaveLength(8);
  });

  it("counts a chip used in the second window against the second window only", () => {
    const statuses = chipStatuses(windows, [{ name: "wildcard", event: 25 }], 26);
    expect(statuses.find((s) => s.name === "wildcard" && s.startEvent === 2)?.state).toEqual({ kind: "expired" });
    expect(statuses.find((s) => s.name === "wildcard" && s.startEvent === 20)?.state).toEqual({ kind: "used", event: 25 });
  });

  it("orders the chips Wildcard, Free Hit, Bench Boost, Triple Captain", () => {
    const names = chipStatuses(windows, [], 12).map((status) => status.name);
    expect(names).toEqual(["wildcard", "wildcard", "freehit", "freehit", "bboost", "bboost", "3xc", "3xc"]);
  });
});
