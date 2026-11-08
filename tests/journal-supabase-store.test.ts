import { afterEach, describe, expect, it, vi } from "vitest";
import { createSupabaseStore } from "@/lib/journal/supabase-store";

const store = createSupabaseStore({ url: "https://example.supabase.test", anonKey: "anon-test", serviceKey: "service-test" });

const reply = (status: number, body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status }));

afterEach(() => vi.unstubAllGlobals());

describe("createProfile outcome", () => {
  it("only the team unique constraint counts as team_taken", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", reply(409, { code: "23505", message: 'duplicate key value violates unique constraint "journal_profiles_team_unique"' }));
    expect(await store.createProfile("u1", 5)).toBe("team_taken");

    vi.stubGlobal("fetch", reply(409, { code: "23505", message: 'duplicate key value violates unique constraint "journal_profiles_pkey"' }));
    expect(await store.createProfile("u1", 5)).toBe("error");

    vi.stubGlobal("fetch", reply(409, { code: "23503", message: "foreign key violation" }));
    expect(await store.createProfile("u1", 5)).toBe("error");

    vi.stubGlobal("fetch", reply(201, {}));
    expect(await store.createProfile("u1", 5)).toBe("ok");
  });
});

describe("signUp existing email", () => {
  it("flags a user with no identities as existing", async () => {
    vi.stubGlobal("fetch", reply(200, { id: "x", email: "a@b.co", identities: [] }));
    expect(await store.signUp("a@b.co", "password1")).toMatchObject({ existing: true });
    vi.stubGlobal("fetch", reply(200, { id: "x", email: "a@b.co", identities: [{}] }));
    expect(await store.signUp("a@b.co", "password1")).toMatchObject({ existing: false });
  });
});

describe("reads do not hide failures", () => {
  it("throws instead of returning an empty list", async () => {
    vi.stubGlobal("fetch", reply(500, { message: "down" }));
    await expect(store.listNotes("u1", "tok")).rejects.toThrow();
    await expect(store.listSnapshots("u1", "tok")).rejects.toThrow();
  });
});
