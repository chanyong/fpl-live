import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthForms } from "@/components/journal-page";

afterEach(() => vi.restoreAllMocks());

describe("journal auth form", () => {
  it("switches mode with tabs (aria-selected, arrow keys)", () => {
    render(<AuthForms onDone={() => {}} />);
    const login = screen.getByRole("tab", { name: "로그인", selected: true });
    const signup = screen.getByRole("tab", { name: "가입", selected: false });
    expect(screen.queryByLabelText("비밀번호 확인")).toBeNull();
    fireEvent.click(signup);
    expect(signup.getAttribute("aria-selected")).toBe("true");
    expect(login.getAttribute("aria-selected")).toBe("false");
    expect(screen.getByLabelText("비밀번호 확인")).toBeTruthy();
    fireEvent.keyDown(signup, { key: "ArrowLeft" });
    expect(login.getAttribute("aria-selected")).toBe("true");
    expect(screen.queryByLabelText("비밀번호 확인")).toBeNull();
  });

  it("warns on mismatch, blocks submit, and never sends the confirm field", async () => {
    const fetchMock = vi.fn(async (url: string) =>
      String(url).startsWith("/api/journal/team-lookup")
        ? { ok: true, status: 200, json: async () => ({ teamId: 123, teamName: "Pleiades", managerName: "Kim Lee" }) }
        : { ok: true, status: 200, json: async () => ({}) }
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<AuthForms onDone={() => {}} />);
    fireEvent.click(screen.getByRole("tab", { name: "가입", selected: false }));
    fireEvent.change(screen.getByLabelText("이메일"), { target: { value: "a@b.co" } });
    fireEvent.change(screen.getByLabelText("비밀번호"), { target: { value: "password1" } });
    fireEvent.change(screen.getByLabelText("비밀번호 확인"), { target: { value: "password2" } });
    expect(screen.getByRole("alert").textContent).toContain("다릅니다");
    expect((screen.getByRole("button", { name: "가입하기" }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(screen.getByLabelText("비밀번호 확인"), { target: { value: "password1" } });
    expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.change(screen.getByLabelText(/FPL 팀 번호/), { target: { value: "123" } });
    fireEvent.click(screen.getByLabelText(/만 14세 이상/));
    // Not confirmed yet: the button stays off and a submit sends nothing.
    expect((screen.getByRole("button", { name: "가입하기" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.submit(screen.getByRole("form", { hidden: true }));
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "조회" }));
    fireEvent.click(await screen.findByLabelText("이 팀이 맞습니다"));
    expect((screen.getByRole("button", { name: "가입하기" }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.submit(screen.getByRole("form", { hidden: true }));
    await waitFor(() => expect(fetchMock.mock.calls.some((call) => String(call[0]) === "/api/journal/signup")).toBe(true));
    const signup = fetchMock.mock.calls.find((call) => String(call[0]) === "/api/journal/signup") as unknown as [string, { body: string }];
    const body = JSON.parse(signup[1].body);
    expect(body.teamId).toBe("123");
    expect(body.password).toBe("password1");
    expect(body).not.toHaveProperty("passwordConfirm");
  });
});

describe("journal login: save ID", () => {
  const KEY = "fpl-live:saved-login-id";
  afterEach(() => localStorage.clear());
  const loginWith = async (ok: boolean) => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok, status: ok ? 200 : 401, json: async () => (ok ? {} : { error: "login_failed" }) })));
    const onDone = vi.fn();
    render(<AuthForms onDone={onDone} />);
    return onDone;
  };

  it("saves the email only after a successful login with the box checked, never the password", async () => {
    const onDone = await loginWith(true);
    fireEvent.change(screen.getByLabelText("이메일"), { target: { value: "a@b.co" } });
    fireEvent.change(screen.getByLabelText("비밀번호"), { target: { value: "secret-pw" } });
    fireEvent.click(screen.getByLabelText("아이디 저장"));
    expect(localStorage.getItem(KEY)).toBeNull();
    fireEvent.submit(screen.getByRole("form", { hidden: true }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(localStorage.getItem(KEY)).toBe("a@b.co");
    expect(JSON.stringify({ ...localStorage })).not.toContain("secret-pw");
  });

  it("does not save when login fails", async () => {
    await loginWith(false);
    fireEvent.change(screen.getByLabelText("이메일"), { target: { value: "a@b.co" } });
    fireEvent.change(screen.getByLabelText("비밀번호"), { target: { value: "bad" } });
    fireEvent.click(screen.getByLabelText("아이디 저장"));
    fireEvent.submit(screen.getByRole("form", { hidden: true }));
    await screen.findByRole("status");
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it("restores the saved email, checks the box, focuses the password, and clears it when unchecked on success", async () => {
    localStorage.setItem(KEY, "saved@b.co");
    const onDone = await loginWith(true);
    await waitFor(() => expect((screen.getByLabelText("이메일") as HTMLInputElement).value).toBe("saved@b.co"));
    expect((screen.getByLabelText("아이디 저장") as HTMLInputElement).checked).toBe(true);
    expect(document.activeElement).toBe(screen.getByLabelText("비밀번호"));
    fireEvent.change(screen.getByLabelText("비밀번호"), { target: { value: "pw" } });
    fireEvent.click(screen.getByLabelText("아이디 저장"));
    fireEvent.submit(screen.getByRole("form", { hidden: true }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(localStorage.getItem(KEY)).toBeNull();
  });
});
