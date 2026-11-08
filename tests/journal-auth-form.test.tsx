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
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
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
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.submit(screen.getByRole("form", { hidden: true }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.password).toBe("password1");
    expect(body).not.toHaveProperty("passwordConfirm");
  });
});
