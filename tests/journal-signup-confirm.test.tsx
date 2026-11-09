import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthForms } from "@/components/journal-page";
import { createSupabaseStore } from "@/lib/journal/supabase-store";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("after sign-up", () => {
  it("tells the user a mail was sent and offers a resend button with cooldown", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, needsConfirmation: true }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<AuthForms onDone={() => {}} />);
    fireEvent.click(screen.getByRole("tab", { name: "가입", selected: false }));
    fireEvent.change(screen.getByLabelText("이메일"), { target: { value: "new@b.co" } });
    fireEvent.change(screen.getByLabelText("비밀번호"), { target: { value: "password1" } });
    fireEvent.change(screen.getByLabelText("비밀번호 확인"), { target: { value: "password1" } });
    fireEvent.change(screen.getByLabelText(/FPL 팀 번호/), { target: { value: "123" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.submit(screen.getByRole("form", { hidden: true }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("확인 메일을 보냈습니다"));
    const resend = screen.getByRole("button", { name: "확인 메일 다시 보내기" }) as HTMLButtonElement;
    expect(resend.disabled).toBe(true);
  });
});

describe("signUp redirect", () => {
  it("passes redirect_to so the confirmation link returns to the journal", async () => {
    const fetchMock = vi.fn(async (..._args: unknown[]) => new Response(JSON.stringify({ id: "x", email: "a@b.co", identities: [{}] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const store = createSupabaseStore({ url: "https://example.supabase.test", anonKey: "a", serviceKey: "s" });
    await store.signUp("a@b.co", "password1", "https://site.test/journal");
    expect(String(fetchMock.mock.calls[0][0])).toBe("https://example.supabase.test/auth/v1/signup?redirect_to=https%3A%2F%2Fsite.test%2Fjournal");
  });
});
