import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const store = {
  signIn: vi.fn(),
  requestPasswordReset: vi.fn(async (..._args: unknown[]) => {}),
  resendConfirmation: vi.fn(async (..._args: unknown[]) => {}),
  updatePassword: vi.fn(async (..._args: unknown[]): Promise<"ok" | "invalid_token" | "error"> => "ok")
};
vi.mock("@/lib/journal/session", async (importActual) => ({
  ...(await importActual<typeof import("@/lib/journal/session")>()),
  requireStore: () => store
}));

import { POST as login } from "@/app/api/journal/login/route";
import { POST as recover } from "@/app/api/journal/recover/route";
import { POST as resend } from "@/app/api/journal/resend/route";
import { POST as resetPassword } from "@/app/api/journal/reset-password/route";
import { parseRecoveryHash } from "@/lib/journal/recovery";

const post = (url: string, body: unknown, headers: Record<string, string> = { "sec-fetch-site": "same-origin" }) =>
  new NextRequest(`http://localhost${url}`, { method: "POST", headers, body: JSON.stringify(body) });

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe("recover", () => {
  it("answers the same for any email and sends the redirect from NEXT_PUBLIC_APP_URL", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://fpl.example.com/");
    const known = await recover(post("/api/journal/recover", { email: "A@b.co" }));
    store.requestPasswordReset.mockRejectedValueOnce(new Error("boom"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const failing = await recover(post("/api/journal/recover", { email: "nobody@b.co" }));
    expect(known.status).toBe(200);
    expect(failing.status).toBe(200);
    expect(await known.json()).toEqual(await failing.json());
    expect(store.requestPasswordReset).toHaveBeenCalledWith("a@b.co", "https://fpl.example.com/journal");
  });

  it("rejects cross-origin and malformed requests without sending mail", async () => {
    expect((await recover(post("/api/journal/recover", { email: "a@b.co" }, { origin: "http://evil.example" }))).status).toBe(403);
    expect((await recover(post("/api/journal/recover", { email: "nope" }))).status).toBe(400);
    expect(store.requestPasswordReset).not.toHaveBeenCalled();
  });
});

describe("resend", () => {
  it("is same-origin only and always answers ok", async () => {
    expect((await resend(post("/api/journal/resend", { email: "a@b.co" }, { origin: "http://evil.example" }))).status).toBe(403);
    const response = await resend(post("/api/journal/resend", { email: "a@b.co" }));
    expect(response.status).toBe(200);
    expect(store.resendConfirmation).toHaveBeenCalledTimes(1);
  });
});

describe("reset-password", () => {
  const body = { accessToken: "t".repeat(40), password: "newpassword1" };

  it("changes the password and sets no session cookie", async () => {
    const response = await resetPassword(post("/api/journal/reset-password", body));
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(store.updatePassword).toHaveBeenCalledWith(body.accessToken, "newpassword1");
  });

  it("maps an expired token, rejects short passwords and cross-origin", async () => {
    store.updatePassword.mockResolvedValueOnce("invalid_token");
    const expired = await resetPassword(post("/api/journal/reset-password", body));
    expect(expired.status).toBe(401);
    expect(await expired.json()).toEqual({ error: "link_expired" });
    expect((await resetPassword(post("/api/journal/reset-password", { ...body, password: "short" }))).status).toBe(400);
    expect((await resetPassword(post("/api/journal/reset-password", body, { origin: "http://evil.example" }))).status).toBe(403);
  });
});

describe("login failure reasons", () => {
  it("only email_not_confirmed is distinguished; everything else is login_failed", async () => {
    const attempt = () => login(post("/api/journal/login", { email: "a@b.co", password: "password1" }));
    store.signIn.mockResolvedValueOnce({ error: "Email not confirmed", code: "email_not_confirmed" });
    expect(await (await attempt()).json()).toEqual({ error: "email_not_confirmed" });
    store.signIn.mockResolvedValueOnce({ error: "Invalid login credentials", code: "invalid_credentials" });
    expect(await (await attempt()).json()).toEqual({ error: "login_failed" });
    store.signIn.mockResolvedValueOnce({ error: "status 500" });
    expect(await (await attempt()).json()).toEqual({ error: "login_failed" });
  });
});

describe("parseRecoveryHash", () => {
  it("reads the recovery token and error fragments", () => {
    expect(parseRecoveryHash("#access_token=abc&type=recovery&expires_in=3600")).toEqual({ kind: "recovery", accessToken: "abc" });
    expect(parseRecoveryHash("#error=access_denied&error_code=otp_expired")).toEqual({ kind: "error", code: "otp_expired" });
    expect(parseRecoveryHash("#access_token=abc&type=signup")).toBeNull();
    expect(parseRecoveryHash("")).toBeNull();
  });
});
