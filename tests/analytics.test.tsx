import { act, render, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnalyticsEvents, useSearchTracking } from "@/components/analytics-events";
import { isFeedbackOpenClick, outboundLinkParams, safeSearchTerm, trackEvent, trackSearch } from "@/lib/analytics";

// GA4 전환 이벤트(#19): search · outbound_click · feedback_open
describe("GA4 events", () => {
  let gtag: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    gtag = vi.fn();
    window.gtag = gtag;
  });

  afterEach(() => {
    delete window.gtag;
    document.body.innerHTML = "";
    vi.useRealTimers();
  });

  it("sends events through the existing gtag and is a no-op without it", () => {
    trackEvent("outbound_click", { link_domain: "example.com" });
    expect(gtag).toHaveBeenCalledWith("event", "outbound_click", { link_domain: "example.com" });

    delete window.gtag;
    expect(() => trackEvent("search")).not.toThrow();
  });

  it("keeps personal data out of search_term", () => {
    expect(safeSearchTerm(" 915874 ")).toBe("915874");
    expect(safeSearchTerm("Salah")).toBe("salah");
    expect(safeSearchTerm("me@example.com")).toBeNull();
    expect(safeSearchTerm("010-1234-5678")).toBeNull();
    expect(safeSearchTerm("   ")).toBeNull();
    expect(safeSearchTerm("x".repeat(80))).toHaveLength(50);

    trackSearch("league_id", "915874");
    expect(gtag).toHaveBeenLastCalledWith("event", "search", { search_area: "league_id", search_term: "915874" });
    trackSearch("league_managers", "Kim Minsu", false);
    expect(gtag).toHaveBeenLastCalledWith("event", "search", { search_area: "league_managers" });
  });

  it("classifies outbound links and drops query strings", () => {
    expect(outboundLinkParams("https://fantasy.premierleague.com/leagues?x=1#a", "fpl.example")).toEqual({
      link_url: "https://fantasy.premierleague.com/leagues",
      link_domain: "fantasy.premierleague.com"
    });
    expect(outboundLinkParams("/price-changes", "fpl.example")).toBeNull();
    expect(outboundLinkParams("https://fpl.example/faq", "fpl.example")).toBeNull();
    expect(outboundLinkParams("mailto:a@b.c", "fpl.example")).toBeNull();
  });

  it("fires outbound_click on external link clicks, not on internal ones", () => {
    render(
      <>
        <AnalyticsEvents />
        <a href="https://ddalkkakrank.kr/?utm_source=fpl">
          <span>out</span>
        </a>
        <a href="/faq">in</a>
      </>
    );
    const [outLink, inLink] = Array.from(document.querySelectorAll("a"));
    inLink.addEventListener("click", (event) => event.preventDefault());
    outLink.addEventListener("click", (event) => event.preventDefault());

    inLink.click();
    expect(gtag).not.toHaveBeenCalled();

    outLink.querySelector("span")!.click();
    expect(gtag).toHaveBeenCalledWith("event", "outbound_click", {
      link_url: "https://ddalkkakrank.kr/",
      link_domain: "ddalkkakrank.kr"
    });
  });

  it("fires feedback_open when the shared feedback button (inside Shadow DOM) is clicked", () => {
    render(<AnalyticsEvents />);
    const host = document.createElement("div");
    host.id = "site-feedback";
    document.body.appendChild(host);
    const root = host.attachShadow({ mode: "open" });
    root.innerHTML = '<div class="wrap"><button type="button" class="open-btn"><svg></svg>의견</button><button class="x">x</button></div>';

    (root.querySelector(".x") as HTMLButtonElement).click();
    expect(gtag).not.toHaveBeenCalled();

    (root.querySelector(".open-btn") as HTMLButtonElement).click();
    expect(gtag).toHaveBeenCalledWith("event", "feedback_open", { page_path: "/" });
    expect(isFeedbackOpenClick([])).toBe(false);
  });

  it("sends one search event after typing settles, not one per keystroke", () => {
    vi.useFakeTimers();
    const { rerender } = renderHook(({ value }) => useSearchTracking(value, "players"), { initialProps: { value: "s" } });
    rerender({ value: "sa" });
    rerender({ value: "sal" });
    rerender({ value: "salah" });
    act(() => {
      vi.advanceTimersByTime(1600);
    });
    expect(gtag).toHaveBeenCalledTimes(1);
    expect(gtag).toHaveBeenCalledWith("event", "search", { search_area: "players", search_term: "salah" });
  });
});
