import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "@/components/locale-provider";
import { PrivacyContent } from "@/components/legal-pages";
import { SiteHeader } from "@/components/site-header";
import { parseMyTeam, parseTeamIdInput } from "@/lib/my-team";
import { formatPriceChange, metricText, parseSquadView } from "@/lib/squad-view";
import { nav } from "./helpers/mock-navigation";
import { squadBootstrap, squadEntry, squadFixtures, squadHistory, squadPicks, squadTransfers } from "./helpers/entry-fpl";
import { buildEntrySquad } from "@/lib/entry-squad";

vi.mock("next/navigation", () => import("./helpers/mock-navigation"));

// Issue #39 stage 2: the remembered team, the saved view, and the policy text for the personal screen.
describe("remembered team", () => {
  it("reads only a well-formed saved team", () => {
    expect(parseMyTeam('{"id":4300767,"name":"Pleiades"}')).toEqual({ id: 4300767, name: "Pleiades" });
    expect(parseMyTeam('{"id":4300767}')).toEqual({ id: 4300767, name: null });
    for (const bad of [null, "", "nope", "[]", '{"id":"5"}', '{"id":-1}', '{"id":1.5}', '{"name":"x"}']) {
      expect(parseMyTeam(bad)).toBeNull();
    }
  });

  it("accepts a typed team ID only as digits", () => {
    expect(parseTeamIdInput(" 4300767 ")).toBe(4300767);
    for (const bad of ["", "0", "-3", "1.2", "abc", "12 34", "99999999999"]) {
      expect(parseTeamIdInput(bad)).toBeNull();
    }
  });
});

describe("saved squad view", () => {
  it("falls back to the pitch with the opponent for anything unreadable", () => {
    expect(parseSquadView(null)).toEqual({ mode: "pitch", metric: "opponent" });
    expect(parseSquadView("not json")).toEqual({ mode: "pitch", metric: "opponent" });
    expect(parseSquadView('{"mode":"list","metric":"selling"}')).toEqual({ mode: "list", metric: "selling" });
    expect(parseSquadView('{"mode":"x","metric":"bogus"}')).toEqual({ mode: "pitch", metric: "opponent" });
  });

  it("formats price moves with a sign and money in millions", () => {
    expect(formatPriceChange(3)).toBe("+0.3");
    expect(formatPriceChange(-2)).toBe("-0.2");
    expect(formatPriceChange(0)).toBe("0.0");

    const data = buildEntrySquad({
      entryId: 1,
      bootstrap: squadBootstrap(),
      fixtures: squadFixtures(),
      entry: squadEntry(),
      history: squadHistory([{ event: 11 }]),
      transfers: squadTransfers(),
      picks: squadPicks(11),
      squadGw: 11,
      eventPointsOverride: null,
      startPrices: new Map(),
      now: 1
    });
    const palmer = data.squad.find((player) => player.webName === "Palmer")!;
    expect(metricText(palmer, "price")).toBe("£11.0m");
    expect(metricText(palmer, "selling")).toBe("£10.5m");
    expect(metricText(palmer, "ownership")).toBe("45.0%");
  });
});

describe("shared header and policy", () => {
  it("has a My team entry in the top menu on every screen", () => {
    nav.set("/fixtures");
    render(
      <LocaleProvider>
        <SiteHeader />
      </LocaleProvider>
    );
    const link = within(screen.getByRole("navigation", { name: "주요 메뉴" })).getByRole("link", { name: "내 팀" });
    expect(link.getAttribute("href")).toBe("/team");
    expect(link.getAttribute("aria-current")).toBeNull();
  });

  it("tells visitors what the personal squad screen processes, and that it stays out of search", () => {
    render(
      <LocaleProvider>
        <PrivacyContent />
      </LocaleProvider>
    );
    const row = screen.getByText(/내 스쿼드 보기 \(\/team/).closest("tr")!;
    expect(row).toHaveTextContent("FPL 팀 번호");
    expect(row).toHaveTextContent("저장하지 않고");
    expect(row).toHaveTextContent("noindex");
    expect(row).toHaveTextContent("IP 주소");
    expect(screen.getByText(/‘내 팀’으로 기억한 FPL 팀 번호/)).toBeInTheDocument();
  });
});
