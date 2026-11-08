import { afterEach, describe, expect, it, vi } from "vitest";
import { createSupabaseStore } from "@/lib/journal/supabase-store";

const store = createSupabaseStore({ url: "https://example.supabase.test", anonKey: "anon-test", serviceKey: "service-test" });

const reply = (status: number, body: unknown) => vi.fn(async (..._args: unknown[]) => new Response(JSON.stringify(body), { status }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("password reset and sign-in codes", () => {
  it("signIn passes the GoTrue error_code through", async () => {
    vi.stubGlobal("fetch", reply(400, { error_code: "email_not_confirmed", msg: "Email not confirmed" }));
    expect(await store.signIn("a@b.co", "password1")).toEqual({ error: "Email not confirmed", code: "email_not_confirmed" });
    vi.stubGlobal("fetch", reply(400, { error_code: "invalid_credentials", msg: "Invalid login credentials" }));
    expect(await store.signIn("a@b.co", "x")).toMatchObject({ code: "invalid_credentials" });
  });

  it("recover and resend carry the redirect target and the anon key only", async () => {
    const fetchMock = reply(200, {});
    vi.stubGlobal("fetch", fetchMock);
    await store.requestPasswordReset("a@b.co", "https://site.test/journal");
    await store.resendConfirmation("a@b.co", "https://site.test/journal");
    const [recover, resend] = fetchMock.mock.calls as unknown as Array<[string, { body: string; headers: Record<string, string> }]>;
    expect(recover[0]).toBe("https://example.supabase.test/auth/v1/recover?redirect_to=https%3A%2F%2Fsite.test%2Fjournal");
    expect(JSON.parse(recover[1].body)).toEqual({ email: "a@b.co" });
    expect(resend[0]).toContain("/auth/v1/resend?redirect_to=");
    expect(JSON.parse(resend[1].body)).toEqual({ type: "signup", email: "a@b.co" });
    expect(recover[1].headers.apikey).toBe("anon-test");
  });

  it("recover does not throw when Supabase errors", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", reply(429, { msg: "rate limit" }));
    await expect(store.requestPasswordReset("nobody@b.co", "https://site.test/journal")).resolves.toBeUndefined();
  });

  it("updatePassword revokes the recovery session and stays ok if that fails", async () => {
    const fetchMock = vi.fn(async (url: unknown) => {
      if (String(url).includes("/logout")) throw new Error("network");
      return new Response("{}", { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    expect(await store.updatePassword("tok", "newpassword1")).toBe("ok");
    expect(String(fetchMock.mock.calls[1][0])).toBe("https://example.supabase.test/auth/v1/logout?scope=local");
  });

  it("updatePassword maps token problems", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", reply(200, {}));
    expect(await store.updatePassword("tok", "newpassword1")).toBe("ok");
    vi.stubGlobal("fetch", reply(401, {}));
    expect(await store.updatePassword("tok", "newpassword1")).toBe("invalid_token");
    vi.stubGlobal("fetch", reply(422, {}));
    expect(await store.updatePassword("tok", "newpassword1")).toBe("error");
  });
});
