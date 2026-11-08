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
import { allowMailRequest, resetRateLimits } from "@/lib/journal/rate-limit";
import { consumeAuthHash, parseRecoveryHash } from "@/lib/journal/recovery";
import { resetPasswordSchema, signupSchema } from "@/lib/journal/types";

const post = (url: string, body: unknown, headers: Record<string, string> = { "sec-fetch-site": "same-origin" }) =>
  new NextRequest(`http://localhost${url}`, { method: "POST", headers, body: JSON.stringify(body) });

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  resetRateLimits();
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
    expect(parseRecoveryHash("#access_token=abc&type=signup")).toEqual({ kind: "confirmed" });
    expect(parseRecoveryHash("#type=signup")).toBeNull();
    expect(parseRecoveryHash("")).toBeNull();
  });

  it("reports a signup confirmation without keeping its tokens and clears them from the address bar", () => {
    const replaceState = vi.fn();
    const where = { hash: "#access_token=abc&refresh_token=def&type=signup", pathname: "/journal", search: "?a=1" };
    expect(consumeAuthHash(where, { replaceState })).toEqual({ kind: "confirmed" });
    expect(replaceState).toHaveBeenCalledWith(null, "", "/journal?a=1");
  });

  it("clears recovery and error fragments, and leaves other hashes alone", () => {
    const replaceState = vi.fn();
    const base = { pathname: "/journal", search: "" };
    expect(consumeAuthHash({ ...base, hash: "#access_token=abc&type=recovery" }, { replaceState })).toEqual({ kind: "recovery", accessToken: "abc" });
    expect(consumeAuthHash({ ...base, hash: "#error=access_denied&error_code=otp_expired" }, { replaceState })).toEqual({ kind: "error", code: "otp_expired" });
    expect(replaceState).toHaveBeenCalledTimes(2);
    replaceState.mockClear();
    expect(consumeAuthHash({ ...base, hash: "#section" }, { replaceState })).toBeNull();
    expect(replaceState).not.toHaveBeenCalled();
  });
});

describe("password byte limit", () => {
  it("counts bytes, not characters, for sign-up and reset", () => {
    const korean = "가".repeat(25); // 25 chars, 75 bytes
    const ok = "가".repeat(24); // 72 bytes
    expect(signupSchema.safeParse({ email: "a@b.co", password: korean, teamId: 1 }).success).toBe(false);
    expect(signupSchema.safeParse({ email: "a@b.co", password: ok, teamId: 1 }).success).toBe(true);
    const token = "t".repeat(30);
    expect(resetPasswordSchema.safeParse({ accessToken: token, password: korean }).success).toBe(false);
    expect(resetPasswordSchema.safeParse({ accessToken: token, password: ok }).success).toBe(true);
  });
});

describe("mail request limits", () => {
  const ipHeaders = (ip: string) => ({ "sec-fetch-site": "same-origin", "x-forwarded-for": `${ip}, 10.0.0.1` });

  it("allows one mail per email per minute", () => {
    expect(allowMailRequest("recover", "a@b.co", "1.1.1.1", 0)).toBe(true);
    expect(allowMailRequest("recover", "a@b.co", "1.1.1.1", 30_000)).toBe(false);
    expect(allowMailRequest("recover", "a@b.co", "1.1.1.1", 61_000)).toBe(true);
    expect(allowMailRequest("resend", "a@b.co", "1.1.1.1", 62_000)).toBe(true);
  });

  it("allows five mails per IP per ten minutes", () => {
    for (let i = 0; i < 5; i += 1) expect(allowMailRequest("recover", `u${i}@b.co`, "2.2.2.2", i)).toBe(true);
    expect(allowMailRequest("recover", "u9@b.co", "2.2.2.2", 1000)).toBe(false);
    expect(allowMailRequest("recover", "u9@b.co", "3.3.3.3", 1000)).toBe(true);
    expect(allowMailRequest("recover", "u8@b.co", "2.2.2.2", 10 * 60_000 + 10)).toBe(true);
  });

  it("limited requests skip the mail but get the identical response", async () => {
    const first = await recover(post("/api/journal/recover", { email: "r@b.co" }, ipHeaders("4.4.4.4")));
    const second = await recover(post("/api/journal/recover", { email: "r@b.co" }, ipHeaders("4.4.4.4")));
    expect(second.status).toBe(first.status);
    expect(await second.json()).toEqual(await first.json());
    expect(store.requestPasswordReset).toHaveBeenCalledTimes(1);

    await resend(post("/api/journal/resend", { email: "r@b.co" }, ipHeaders("4.4.4.4")));
    const again = await resend(post("/api/journal/resend", { email: "r@b.co" }, ipHeaders("4.4.4.4")));
    expect(await again.json()).toEqual({ ok: true });
    expect(store.resendConfirmation).toHaveBeenCalledTimes(1);
  });
});
