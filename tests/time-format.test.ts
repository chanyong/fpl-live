import { describe, expect, it } from "vitest";
import { countdownLabel, relativeTimeLabel } from "@/lib/time-format";

const NOW = Date.parse("2026-08-22T12:00:00Z");
const at = (offsetMs: number) => new Date(NOW + offsetMs).toISOString();

describe("relativeTimeLabel", () => {
  it("reads as fresh inside ten seconds", () => {
    expect(relativeTimeLabel(at(-3_000), NOW)).toBe("방금 전");
  });

  it("counts seconds, minutes, hours and days", () => {
    expect(relativeTimeLabel(at(-42_000), NOW)).toBe("42초 전");
    expect(relativeTimeLabel(at(-5 * 60_000), NOW)).toBe("5분 전");
    expect(relativeTimeLabel(at(-3 * 3_600_000), NOW)).toBe("3시간 전");
    expect(relativeTimeLabel(at(-2 * 86_400_000), NOW)).toBe("2일 전");
  });

  it("never shows a negative age for a clock skewed ahead", () => {
    expect(relativeTimeLabel(at(5_000), NOW)).toBe("방금 전");
  });

  it("handles missing and unparseable timestamps", () => {
    expect(relativeTimeLabel(null, NOW)).toBe("-");
    expect(relativeTimeLabel("not-a-date", NOW)).toBe("-");
  });
});

describe("countdownLabel", () => {
  it("counts down in minutes, hours and days", () => {
    expect(countdownLabel(at(25 * 60_000), NOW)).toBe("25분 후");
    expect(countdownLabel(at(2 * 3_600_000 + 15 * 60_000), NOW)).toBe("2시간 15분 후");
    expect(countdownLabel(at(3 * 3_600_000), NOW)).toBe("3시간 후");
    expect(countdownLabel(at(2 * 86_400_000), NOW)).toBe("2일 후");
  });

  it("rounds a sub-minute wait up rather than showing zero", () => {
    expect(countdownLabel(at(20_000), NOW)).toBe("1분 후");
  });

  it("returns null once kickoff has passed", () => {
    expect(countdownLabel(at(-1_000), NOW)).toBeNull();
    expect(countdownLabel(null, NOW)).toBeNull();
  });
});
