import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthForms, ResetPasswordForm } from "@/components/journal-page";

afterEach(() => vi.restoreAllMocks());

describe("password reset and unconfirmed login", () => {
  it("shows the same reply for forgot-password and locks the button during cooldown", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<AuthForms onDone={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "비밀번호를 잊으셨나요?" }));
    expect(screen.queryByLabelText("비밀번호")).toBeNull();
    fireEvent.change(screen.getByLabelText("이메일"), { target: { value: "who@b.co" } });
    fireEvent.submit(screen.getByRole("form", { hidden: true }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("계정이 있으면"));
    expect(fetchMock.mock.calls[0][0]).toBe("/api/journal/recover");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ email: "who@b.co" });
    expect((screen.getByRole("button", { name: "재설정 메일 보내기" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("offers to resend the confirmation mail only for email_not_confirmed", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: "login_failed" }) })
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: "email_not_confirmed" }) })
      .mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<AuthForms onDone={() => {}} />);
    fireEvent.change(screen.getByLabelText("이메일"), { target: { value: "a@b.co" } });
    fireEvent.change(screen.getByLabelText("비밀번호"), { target: { value: "password1" } });
    fireEvent.submit(screen.getByRole("form", { hidden: true }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("맞지 않습니다"));
    expect(screen.queryByRole("button", { name: "확인 메일 다시 보내기" })).toBeNull();

    fireEvent.submit(screen.getByRole("form", { hidden: true }));
    const resendButton = await screen.findByRole("button", { name: "확인 메일 다시 보내기" });
    expect(screen.getByRole("status").textContent).toContain("이메일 확인이 아직");
    fireEvent.click(resendButton);
    await waitFor(() => expect(fetchMock.mock.calls[2][0]).toBe("/api/journal/resend"));
    expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toEqual({ email: "a@b.co" });
  });
});

describe("reset password form", () => {
  it("blocks mismatched passwords and posts the token with the new password only", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    vi.stubGlobal("fetch", fetchMock);
    const done = vi.fn();
    render(<ResetPasswordForm token={"t".repeat(30)} onDone={done} onExpired={() => {}} />);
    fireEvent.change(screen.getByLabelText("새 비밀번호"), { target: { value: "newpassword1" } });
    fireEvent.change(screen.getByLabelText("새 비밀번호 확인"), { target: { value: "different1" } });
    expect(screen.getByRole("alert").textContent).toContain("다릅니다");
    expect((screen.getByRole("button", { name: "비밀번호 바꾸기" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("새 비밀번호 확인"), { target: { value: "newpassword1" } });
    fireEvent.submit(screen.getByRole("form", { hidden: true }));
    await waitFor(() => expect(done).toHaveBeenCalled());
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ accessToken: "t".repeat(30), password: "newpassword1" });
  });

  it("returns to the request screen when the link has expired", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "link_expired" }) }));
    const expired = vi.fn();
    render(<ResetPasswordForm token={"t".repeat(30)} onDone={() => {}} onExpired={expired} />);
    fireEvent.change(screen.getByLabelText("새 비밀번호"), { target: { value: "newpassword1" } });
    fireEvent.change(screen.getByLabelText("새 비밀번호 확인"), { target: { value: "newpassword1" } });
    fireEvent.submit(screen.getByRole("form", { hidden: true }));
    await waitFor(() => expect(expired).toHaveBeenCalled());
  });
});
