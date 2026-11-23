import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AccountMenu } from "@/components/account-menu";
import { LocaleProvider } from "@/components/locale-provider";

function renderMenu() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <LocaleProvider>
        <AccountMenu />
      </LocaleProvider>
    </QueryClientProvider>
  );
}

function mockMe(body: unknown) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })));
}

afterEach(() => vi.unstubAllGlobals());

describe("AccountMenu (issue #82)", () => {
  it("links a visitor to the journal login", async () => {
    mockMe({ member: false });
    renderMenu();
    const link = await screen.findByRole("link", { name: /로그인/ });
    expect(link.getAttribute("href")).toBe("/journal");
  });

  it("gives a member a menu with my journal, my team and log out", async () => {
    mockMe({ member: true, teamId: 100 });
    renderMenu();
    fireEvent.click(await screen.findByRole("button", { name: /내 일지/ }));
    expect(screen.getByRole("menuitem", { name: "내 일지" }).getAttribute("href")).toBe("/journal");
    expect(screen.getByRole("menuitem", { name: "내 팀" }).getAttribute("href")).toBe("/team");
    expect(screen.getByRole("menuitem", { name: "로그아웃" })).toBeTruthy();
  });
});
