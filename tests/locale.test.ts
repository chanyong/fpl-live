import { describe, expect, it } from "vitest";
import { chipLabel } from "@/lib/chips";
import { pick } from "@/lib/locale";
import { availability, pointsLabel, pointsValueLabel } from "@/lib/player-metrics";
import { countdownLabel, relativeTimeLabel } from "@/lib/time-format";

const NOW = Date.parse("2026-08-22T12:00:00Z");
const at = (offsetMs: number) => new Date(NOW + offsetMs).toISOString();

describe("locale helpers", () => {
  it("picks the text for the active language", () => {
    expect(pick("ko", "한국어", "English")).toBe("한국어");
    expect(pick("en", "한국어", "English")).toBe("English");
  });

  it("keeps Korean as the default for the time labels", () => {
    expect(relativeTimeLabel(at(-5 * 60_000), NOW)).toBe("5분 전");
    expect(countdownLabel(at(2 * 3_600_000 + 15 * 60_000), NOW)).toBe("2시간 15분 후");
  });

  it("spells the time labels in English", () => {
    expect(relativeTimeLabel(at(-3_000), NOW, "en")).toBe("just now");
    expect(relativeTimeLabel(at(-5 * 60_000), NOW, "en")).toBe("5m ago");
    expect(relativeTimeLabel(at(-2 * 86_400_000), NOW, "en")).toBe("2d ago");
    expect(countdownLabel(at(2 * 3_600_000 + 15 * 60_000), NOW, "en")).toBe("in 2h 15m");
    expect(countdownLabel(at(26 * 3_600_000), NOW, "en")).toBe("in 1d 2h");
  });

  it("names chips, availability and scoring lines per language", () => {
    expect(chipLabel("bboost", false)).toBe("벤치 부스트");
    expect(chipLabel("bboost", false, "en")).toBe("Bench Boost");
    expect(chipLabel("3xc", true, "en")).toBe("TC");
    expect(availability("i").label).toBe("부상");
    expect(availability("i", "en").label).toBe("Injured");
    expect(pointsLabel("goals_scored", "en")).toBe("Goals scored");
    expect(pointsValueLabel("goals_scored", 2, "en")).toBe("2 goals");
    expect(pointsValueLabel("clean_sheets", 1, "en")).toBe("Yes");
    expect(pointsValueLabel("minutes", 90)).toBe("90분");
  });
});
