import { render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "@/components/locale-provider";
import { PublicPageFrame } from "@/components/public-page-frame";
import { SiteHeader } from "@/components/site-header";
import { PUBLIC_MENU, PUBLIC_PAGES } from "@/lib/public-pages";
import { PrivacyContent } from "@/components/legal-pages";
import FaqPage from "@/app/faq/page";
import { RECENT_LEAGUES_KEY } from "@/lib/recent-leagues";
import { nav } from "./helpers/mock-navigation";

vi.mock("next/navigation", () => import("./helpers/mock-navigation"));

// Issue #39 stage 1: one logo-and-home link on every screen, and a top menu of icon + label.
function inLocale(node: React.ReactElement) {
  return render(<LocaleProvider>{node}</LocaleProvider>);
}

describe("site logo and home link", () => {
  it("links to the home page from the header", () => {
    inLocale(<SiteHeader />);
    const home = screen.getByRole("link", { name: "FPL Live 홈으로" });
    expect(home.getAttribute("href")).toBe("/");
    expect(home.textContent).toContain("FPL Live");
  });

  it("replaces the differently worded home buttons on league-free pages", () => {
    inLocale(
      <PublicPageFrame title={{ ko: "제목", en: "Title" }} subtitle={{ ko: "설명", en: "Sub" }}>
        <p>본문</p>
      </PublicPageFrame>
    );
    expect(screen.getByRole("link", { name: "FPL Live 홈으로" }).getAttribute("href")).toBe("/");
    expect(screen.queryByText("내 리그 보기")).toBeNull();
  });

  it("is the way home on the legal pages and the FAQ instead of '← FPL Live'", () => {
    const { unmount } = inLocale(<PrivacyContent />);
    expect(screen.getByRole("link", { name: "FPL Live 홈으로" }).getAttribute("href")).toBe("/");
    expect(screen.queryByText("← FPL Live")).toBeNull();
    unmount();

    inLocale(<FaqPage />);
    expect(screen.getByRole("link", { name: "FPL Live 홈으로" }).getAttribute("href")).toBe("/");
    expect(screen.queryByText("← FPL Live")).toBeNull();
  });
});

describe("my league menu item (issue #39)", () => {
  afterEach(() => window.localStorage.clear());
  const menuLink = () => within(screen.getByRole("navigation", { name: "주요 메뉴" })).getByRole("link", { name: "내 리그" });

  it("points home (league search) when no league was opened in this browser", () => {
    nav.set("/fixtures");
    inLocale(<SiteHeader />);
    expect(menuLink().getAttribute("href")).toBe("/");
    expect(menuLink().getAttribute("aria-current")).toBeNull();
  });

  it("opens the league viewed most recently, read from the recent-leagues list after mount", async () => {
    window.localStorage.setItem(
      RECENT_LEAGUES_KEY,
      JSON.stringify([
        { id: 915874, name: "KIC", viewedAt: 2 },
        { id: 111, name: null, viewedAt: 1 }
      ])
    );
    nav.set("/fixtures");
    inLocale(<SiteHeader />);
    await waitFor(() => expect(menuLink().getAttribute("href")).toBe("/league/915874"));
  });

  it("follows the league on screen and marks the page as current", () => {
    window.localStorage.setItem(RECENT_LEAGUES_KEY, JSON.stringify([{ id: 915874, name: null, viewedAt: 1 }]));
    nav.set("/league/42/standings/trend");
    inLocale(<SiteHeader />);
    expect(menuLink().getAttribute("href")).toBe("/league/42");
    expect(menuLink().getAttribute("aria-current")).toBe("page");
  });
});

describe("top menu icons", () => {
  it("gives every menu page an icon and keeps its label", () => {
    nav.set("/fixtures");
    inLocale(<SiteHeader />);
    const menu = screen.getByRole("navigation", { name: "주요 메뉴" });

    for (const key of PUBLIC_MENU) {
      const page = PUBLIC_PAGES[key];
      const link = within(menu).getByRole("link", { name: page.label.ko });
      expect(link.getAttribute("href")).toBe(page.path);
      expect(link.querySelector("svg[aria-hidden='true']")).not.toBeNull();
    }
    expect(within(menu).getByRole("link", { name: "경기 일정" }).getAttribute("aria-current")).toBe("page");
  });
});
