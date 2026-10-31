import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SiteFooter } from "@/components/site-footer";
import { ALL_NETWORK_SITES, NETWORK_SITES, SELF_URL, networkHref } from "@/lib/network";

// 하단 '운영자의 다른 서비스' 카드 띠(전 사이트 공통 사양 chanyong/ddalkkak-rank#12).
describe("network footer", () => {
  it("lists the 10 other sites in field order and leaves this site out", () => {
    expect(ALL_NETWORK_SITES).toHaveLength(11);
    expect(NETWORK_SITES).toHaveLength(10);
    expect(NETWORK_SITES.some((site) => site.url === SELF_URL)).toBe(false);
    expect(NETWORK_SITES.map((site) => site.name)).toEqual([
      "에어모아",
      "내여행 찾아줌",
      "이때다",
      "숲가자",
      "ETFX",
      "카드매치",
      "내 압구정",
      "자동차보험 환급 비교",
      "입시on",
      "딸깍랭크"
    ]);
  });

  it("tags links with this site's utm key and keeps an existing query", () => {
    expect(networkHref("https://www.airmoa.kr")).toBe(
      "https://www.airmoa.kr/?utm_source=fpl&utm_medium=footer_network"
    );
    expect(networkHref("https://example.com/path?x=1")).toBe(
      "https://example.com/path?x=1&utm_source=fpl&utm_medium=footer_network"
    );
  });

  it("renders static new-tab links above the legal notice", () => {
    const { container } = render(<SiteFooter />);
    const nav = screen.getByRole("navigation", { name: "운영자의 다른 서비스" });
    expect(within(nav).getByRole("heading", { level: 2, name: "운영자의 다른 서비스" })).toBeInTheDocument();

    const links = within(nav).getAllByRole("link");
    expect(links).toHaveLength(10);
    for (const link of links) {
      expect(link.getAttribute("href")).toMatch(/[?&]utm_source=fpl&utm_medium=footer_network$/);
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener");
    }
    expect(within(nav).queryByText("FPL Live")).toBeNull();

    // 띠가 법적 고지보다 먼저 나온다.
    const notice = screen.getByText(/비공식 팬 서비스/);
    expect(nav.compareDocumentPosition(notice) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(container.querySelector("footer")?.firstElementChild).toBe(nav);
  });
});
