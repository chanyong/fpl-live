import { describe, expect, it } from "vitest";
import { mapWithConcurrency } from "@/lib/concurrency";

describe("mapWithConcurrency", () => {
  it("preserves input order", async () => {
    const results = await mapWithConcurrency([1, 2, 3, 4, 5], 2, async (value) => value * 2);

    expect(results.map((result) => (result.status === "fulfilled" ? result.value : null))).toEqual([
      2, 4, 6, 8, 10
    ]);
  });

  it("never exceeds the concurrency limit", async () => {
    let inFlight = 0;
    let peak = 0;

    await mapWithConcurrency(Array.from({ length: 20 }, (_, i) => i), 3, async (value) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 1));
      inFlight -= 1;
      return value;
    });

    expect(peak).toBeLessThanOrEqual(3);
  });

  it("isolates failures instead of rejecting the batch", async () => {
    const results = await mapWithConcurrency([1, 2, 3], 2, async (value) => {
      if (value === 2) {
        throw new Error("boom");
      }
      return value;
    });

    expect(results[0].status).toBe("fulfilled");
    expect(results[1].status).toBe("rejected");
    expect(results[2].status).toBe("fulfilled");
  });

  it("handles an empty list", async () => {
    await expect(mapWithConcurrency([], 4, async (value) => value)).resolves.toEqual([]);
  });
});
