import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SiteFooter } from "@/components/site-footer";

// Issue #39 (2026-11-23): the "more from the operator" card band was removed from this site only.
describe("site footer", () => {
  it("keeps the unofficial notice and the page links, with no cross-site card band", () => {
    const { container } = render(<SiteFooter />);
    expect(screen.getByText(/비공식 팬 서비스/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "개인정보처리방침" })).toHaveAttribute("href", "/privacy");
    expect(screen.queryByText("운영자의 다른 서비스")).toBeNull();
    expect(container.querySelector("a[target='_blank']")).toBeNull();
    expect(container.innerHTML).not.toMatch(/utm_medium=footer_network/);
  });
});
