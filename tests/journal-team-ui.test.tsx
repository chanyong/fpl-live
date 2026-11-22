import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "@/components/locale-provider";
import { TeamEntryPage } from "@/components/team-entry-page";
import { TeamPicker, type ConfirmedTeam } from "@/components/team-picker";
import { TeamRow } from "@/components/team-row";
import { MY_TEAM_KEY } from "@/lib/my-team";
import { nav } from "./helpers/mock-navigation";

vi.mock("next/navigation", () => import("./helpers/mock-navigation"));

// Issue #47: the lookup -> "this is my team" step, the team change on the journal screen, and /team for a member.
const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));

type Handler = (url: string, init?: RequestInit) => Promise<Response>;
function stub(handler: Handler) {
  const calls: Array<{ url: string; method: string; body: unknown }> = [];
  const fake = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, method: init?.method ?? "GET", body: typeof init?.body === "string" ? JSON.parse(init.body) : null });
    return handler(url, init);
  });
  vi.stubGlobal("fetch", fake);
  return calls;
}

const lookupOk = (url: string) => {
  const id = Number(new URL(url, "http://x").searchParams.get("teamId"));
  return json({ teamId: id, teamName: id === 111 ? "Old FC" : "Pleiades", managerName: "Kim Lee" });
};

beforeEach(() => {
  window.localStorage.clear();
  nav.set("/team");
});
afterEach(() => vi.unstubAllGlobals());

describe("TeamPicker", () => {
  function renderPicker(onConfirmed: (team: ConfirmedTeam | null) => void) {
    return render(
      <LocaleProvider>
        <TeamPicker onConfirmed={onConfirmed} />
      </LocaleProvider>
    );
  }

  it("shows the team name and manager, and reports the team only after \"이 팀이 맞습니다\"", async () => {
    stub((url) => lookupOk(url));
    const onConfirmed = vi.fn();
    renderPicker(onConfirmed);
    fireEvent.change(screen.getByLabelText("FPL 팀 번호"), { target: { value: "222" } });
    fireEvent.click(screen.getByRole("button", { name: "조회" }));
    expect(await screen.findByText("Pleiades")).toBeInTheDocument();
    expect(screen.getByText(/Kim Lee/)).toBeInTheDocument();
    expect(onConfirmed).not.toHaveBeenCalledWith(expect.objectContaining({ teamId: 222 }));

    fireEvent.click(screen.getByLabelText("이 팀이 맞습니다"));
    expect(onConfirmed).toHaveBeenLastCalledWith({ teamId: 222, teamName: "Pleiades", managerName: "Kim Lee" });
  });

  it("drops the confirmation as soon as the number is edited", async () => {
    stub((url) => lookupOk(url));
    const onConfirmed = vi.fn();
    renderPicker(onConfirmed);
    fireEvent.change(screen.getByLabelText("FPL 팀 번호"), { target: { value: "222" } });
    fireEvent.click(screen.getByRole("button", { name: "조회" }));
    fireEvent.click(await screen.findByLabelText("이 팀이 맞습니다"));

    fireEvent.change(screen.getByLabelText("FPL 팀 번호"), { target: { value: "2223" } });
    expect(onConfirmed).toHaveBeenLastCalledWith(null);
    expect(screen.queryByLabelText("이 팀이 맞습니다")).toBeNull();
  });

  it("says why a lookup failed, and does not call the server for something that is not a number", async () => {
    const calls = stub(() => json({ error: "team_not_found" }, 404));
    renderPicker(vi.fn());
    fireEvent.change(screen.getByLabelText("FPL 팀 번호"), { target: { value: "12ab" } });
    fireEvent.click(screen.getByRole("button", { name: "조회" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("숫자만");
    expect(calls).toHaveLength(0);

    fireEvent.change(screen.getByLabelText("FPL 팀 번호"), { target: { value: "999" } });
    fireEvent.click(screen.getByRole("button", { name: "조회" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("찾지 못했습니다"));
    expect(screen.queryByLabelText("이 팀이 맞습니다")).toBeNull();
  });

  it("Enter looks the number up instead of submitting a surrounding form", async () => {
    const calls = stub((url) => lookupOk(url));
    const submit = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
    render(
      <LocaleProvider>
        <form onSubmit={submit}>
          <TeamPicker onConfirmed={() => {}} />
        </form>
      </LocaleProvider>
    );
    fireEvent.change(screen.getByLabelText("FPL 팀 번호"), { target: { value: "222" } });
    fireEvent.keyDown(screen.getByLabelText("FPL 팀 번호"), { key: "Enter" });
    await screen.findByText("Pleiades");
    expect(submit).not.toHaveBeenCalled();
    expect(calls).toHaveLength(1);
  });
});

describe("TeamRow (team change on the journal screen)", () => {
  function renderRow(props: { teamId?: number | null; nextChangeAt?: string | null; onChanged?: () => void } = {}) {
    return render(
      <LocaleProvider>
        <TeamRow teamId={props.teamId === undefined ? 111 : props.teamId} nextChangeAt={props.nextChangeAt ?? null} onChanged={props.onChanged ?? (() => {})} />
      </LocaleProvider>
    );
  }

  it("shows the registered team with its name when FPL answers", async () => {
    stub((url) => lookupOk(url));
    renderRow();
    expect(await screen.findByText("Old FC (#111)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "팀 바꾸기" })).toBeEnabled();
  });

  it("shows just the number when the name cannot be read", async () => {
    stub(() => json({ error: "fpl_unavailable" }, 503));
    renderRow();
    expect(await screen.findByText("#111")).toBeInTheDocument();
  });

  it("goes through lookup and confirmation, says what is deleted and the 30-day wait, then changes without a browser dialog", async () => {
    const confirm = vi.spyOn(window, "confirm");
    const alert = vi.spyOn(window, "alert");
    const calls = stub((url) => (url.startsWith("/api/journal/team-lookup") ? lookupOk(url) : json({ ok: true })));
    const onChanged = vi.fn();
    renderRow({ onChanged });
    await screen.findByText("Old FC (#111)");

    fireEvent.click(screen.getByRole("button", { name: "팀 바꾸기" }));
    const change = screen.getByRole("button", { name: "이 팀으로 바꾸기" });
    expect(change).toBeDisabled();
    fireEvent.change(screen.getByLabelText("FPL 팀 번호"), { target: { value: "222" } });
    fireEvent.click(screen.getByRole("button", { name: "조회" }));
    fireEvent.click(await screen.findByLabelText("이 팀이 맞습니다"));

    const note = screen.getByRole("note");
    expect(note).toHaveTextContent("자동 저장된 지난 기록은 지워지고 새 팀 기준으로 다시 쌓입니다. 직접 쓴 메모는 남습니다.");
    expect(note).toHaveTextContent("바꾼 뒤 30일 동안은 다시 바꿀 수 없습니다.");
    expect(change).toBeEnabled();
    fireEvent.click(change);

    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(calls.filter((call) => call.method === "POST")).toEqual([{ url: "/api/journal/team", method: "POST", body: { teamId: 222 } }]);
    expect(confirm).not.toHaveBeenCalled();
    expect(alert).not.toHaveBeenCalled();
    expect(await screen.findByText(/팀을 바꿨습니다/)).toBeInTheDocument();
  });

  it("shows the next possible date for too_soon, and disables the button when the wait is already known", async () => {
    stub((url) => (url.startsWith("/api/journal/team-lookup") ? lookupOk(url) : json({ error: "too_soon", nextTeamChangeAt: "2026-12-20T00:00:00.000Z" }, 429)));
    renderRow();
    await screen.findByText("Old FC (#111)");
    fireEvent.click(screen.getByRole("button", { name: "팀 바꾸기" }));
    fireEvent.change(screen.getByLabelText("FPL 팀 번호"), { target: { value: "222" } });
    fireEvent.click(screen.getByRole("button", { name: "조회" }));
    fireEvent.click(await screen.findByLabelText("이 팀이 맞습니다"));
    fireEvent.click(screen.getByRole("button", { name: "이 팀으로 바꾸기" }));
    expect(await screen.findByText(/2026년 12월 20일 이후에 다시 바꿀 수 있습니다/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "팀 바꾸기" })).toBeDisabled();
  });

  it("starts with the button off and the date shown when the server already says the wait is on", async () => {
    stub((url) => lookupOk(url));
    renderRow({ nextChangeAt: "2026-12-20T00:00:00.000Z" });
    expect(await screen.findByText(/2026년 12월 20일 이후에 다시 바꿀 수 있습니다/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "팀 바꾸기" })).toBeDisabled();
  });

  it("explains a taken team number and keeps the form open", async () => {
    stub((url) => (url.startsWith("/api/journal/team-lookup") ? lookupOk(url) : json({ error: "team_taken" }, 409)));
    renderRow();
    await screen.findByText("Old FC (#111)");
    fireEvent.click(screen.getByRole("button", { name: "팀 바꾸기" }));
    fireEvent.change(screen.getByLabelText("FPL 팀 번호"), { target: { value: "222" } });
    fireEvent.click(screen.getByRole("button", { name: "조회" }));
    fireEvent.click(await screen.findByLabelText("이 팀이 맞습니다"));
    fireEvent.click(screen.getByRole("button", { name: "이 팀으로 바꾸기" }));
    expect(await screen.findByText(/이미 다른 계정에 등록된 팀 번호/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "이 팀으로 바꾸기" })).toBeInTheDocument();
  });
});

describe("/team for a signed-in member", () => {
  function renderEntry() {
    return render(
      <LocaleProvider>
        <TeamEntryPage />
      </LocaleProvider>
    );
  }

  it("opens the registered team, ahead of the team remembered in this browser", async () => {
    window.localStorage.setItem(MY_TEAM_KEY, JSON.stringify({ id: 4300767, name: "Remembered" }));
    stub(() => json({ member: true, teamId: 222, nextTeamChangeAt: null }));
    renderEntry();
    await waitFor(() => expect(nav.path).toBe("/team/222"));
    expect(screen.queryByLabelText("FPL 팀 ID")).toBeNull();
  });

  it("does not flash the form while the answer is on its way, and falls back to the remembered team for a visitor", async () => {
    window.localStorage.setItem(MY_TEAM_KEY, JSON.stringify({ id: 4300767, name: "Remembered" }));
    stub(() => json({ member: false }));
    renderEntry();
    expect(screen.queryByLabelText("FPL 팀 ID")).toBeNull();
    await waitFor(() => expect(nav.path).toBe("/team/4300767"));
  });

  it("asks for a team ID for a member with no registered team and nothing remembered", async () => {
    stub(() => json({ member: true, teamId: null, nextTeamChangeAt: null }));
    renderEntry();
    expect(await screen.findByLabelText("FPL 팀 ID")).toBeInTheDocument();
  });

  it("still works when the member answer cannot be read", async () => {
    stub(() => json({ error: "x" }, 502));
    renderEntry();
    expect(await screen.findByLabelText("FPL 팀 ID")).toBeInTheDocument();
  });
});
