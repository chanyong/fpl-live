import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChartScroll } from "@/components/charts/chart-scroll";
import { BarSeries } from "@/components/charts/mini-series";
import { chartName, spreadLabels } from "@/components/rank-change-panel";

// Issue #2 review: charts drawn 1:1 so their 13px labels stay 13px.

function series(count: number) {
  // Values 101, 102, ... so bar values never collide with the GW labels 1, 2, ...
  return Array.from({ length: count }, (_, index) => ({ label: String(index + 1), value: 101 + index }));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("BarSeries labels", () => {
  it("prints every GW label when there is room", () => {
    render(<BarSeries points={series(10)} />);
    for (let gw = 1; gw <= 10; gw += 1) {
      expect(screen.getByText(String(gw))).toBeInTheDocument();
    }
  });

  it("prints every other GW label late in the season, always keeping the latest", () => {
    render(<BarSeries points={series(38)} />);
    expect(screen.getByText("38")).toBeInTheDocument();
    expect(screen.queryByText("37")).not.toBeInTheDocument();
    expect(screen.getByText("36")).toBeInTheDocument();
  });

  it("labels the latest bar's value even without showValues, since the axis may be scrolled away", () => {
    render(<BarSeries points={series(10)} />);
    expect(screen.getByText("110")).toBeInTheDocument();
    expect(screen.queryByText("109")).not.toBeInTheDocument();
  });
});

describe("ChartScroll", () => {
  it("opens at the right end and goes back there when resetKey changes", () => {
    vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(900);
    const view = render(
      <ChartScroll resetKey="a">
        <svg />
      </ChartScroll>
    );
    const scroller = view.container.firstElementChild as HTMLElement;
    expect(scroller.scrollLeft).toBe(900);

    scroller.scrollLeft = 0;
    view.rerender(
      <ChartScroll resetKey="b">
        <svg />
      </ChartScroll>
    );
    expect(scroller.scrollLeft).toBe(900);
  });
});

describe("rank chart name labels", () => {
  it("keeps names that fit", () => {
    expect(chartName("Christopher Robinson")).toBe("Christopher Robinson");
    expect(chartName("정찬용")).toBe("정찬용");
  });

  it("shortens names by width, not by character count", () => {
    const hangul = chartName("가나다라마바사아자차카타");
    expect(hangul.endsWith("…")).toBe(true);
    expect(hangul.length).toBeLessThan(12);

    const capitals = chartName("MAXIMILIAN WOJCIECHOWSKI");
    expect(capitals.endsWith("…")).toBe(true);
  });

  it("never splits an emoji in half", () => {
    const name = chartName("😀😀😀😀😀😀😀😀😀😀😀😀😀😀");
    expect(name.endsWith("…")).toBe(true);
    expect(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/.test(name)).toBe(false);
  });

  it("keeps tied names inside the chart instead of pushing them past the bottom", () => {
    const bottom = 258;
    const placed = spreadLabels(
      [1, 2, 3, 4].map((key) => ({ key, y: bottom })),
      15,
      bottom
    );
    const ys = [...placed.values()].sort((a, b) => a - b);
    expect(Math.max(...ys)).toBeLessThanOrEqual(bottom);
    ys.slice(1).forEach((y, index) => expect(y - ys[index]).toBeGreaterThanOrEqual(15));
  });
});
