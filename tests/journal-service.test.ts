import { describe, expect, it, vi } from "vitest";
import { isValidCronSecret, runSnapshotJob, signUpMember, type FplSource } from "@/lib/journal/service";
import { notesSchema, signupSchema, type JournalNotes, type JournalStore } from "@/lib/journal/types";

function fakeStore(overrides: Partial<JournalStore> = {}) {
  const snapshots = new Map<string, Set<number>>();
  const store: JournalStore = {
    signUp: vi.fn(async () => ({ user: { id: "u1", email: "a@b.co" } })),
    signIn: vi.fn(),
    deleteUser: vi.fn(async () => {}),
    teamTaken: vi.fn(async () => false),
    getUser: vi.fn(async () => null),
    createProfile: vi.fn(async () => true),
    getProfile: vi.fn(async () => null),
    listProfiles: vi.fn(async () => [
      { userId: "u1", teamId: 111 },
      { userId: "u2", teamId: 222 }
    ]),
    listSnapshots: vi.fn(async () => []),
    savedGws: vi.fn(async (id: string) => [...(snapshots.get(id) ?? [])]),
    saveSnapshot: vi.fn(async (id: string, gw: number) => {
      snapshots.set(id, (snapshots.get(id) ?? new Set()).add(gw));
    }),
    listNotes: vi.fn(async (): Promise<JournalNotes[]> => []),
    saveNotes: vi.fn(async () => {}),
    ...overrides
  };
  return store;
}

describe("signUpMember", () => {
  const input = { email: "a@b.co", password: "password1", teamId: 5 };

  it("rejects an unknown FPL team before touching auth", async () => {
    const store = fakeStore();
    expect(await signUpMember(store, input, async () => false)).toEqual({ ok: false, code: "team_not_found" });
    expect(store.signUp).not.toHaveBeenCalled();
  });

  it("blocks a team number that already has an account", async () => {
    const store = fakeStore({ teamTaken: vi.fn(async () => true) });
    expect(await signUpMember(store, input, async () => true)).toEqual({ ok: false, code: "team_taken" });
    expect(store.signUp).not.toHaveBeenCalled();
  });

  it("removes the new account when it loses a race for the team number", async () => {
    const store = fakeStore({ createProfile: vi.fn(async () => false) });
    expect(await signUpMember(store, input, async () => true)).toEqual({ ok: false, code: "team_taken" });
    expect(store.deleteUser).toHaveBeenCalledWith("u1");
  });

  it("creates account and profile", async () => {
    const store = fakeStore();
    expect(await signUpMember(store, input, async () => true)).toMatchObject({ ok: true });
    expect(store.createProfile).toHaveBeenCalledWith("u1", 5);
  });

  it("surfaces auth failures", async () => {
    const store = fakeStore({ signUp: vi.fn(async () => ({ error: "weak" })) });
    expect(await signUpMember(store, input, async () => true)).toMatchObject({ ok: false, code: "signup_failed" });
  });
});

describe("runSnapshotJob", () => {
  const history = {
    current: [1, 2].map((event) => ({
      event,
      points: 50,
      total_points: 50 * event,
      overall_rank: 10,
      event_transfers: 0,
      event_transfers_cost: 0,
      points_on_bench: 0
    })),
    chips: []
  };
  const fpl = (overrides: Partial<FplSource> = {}): FplSource => ({
    events: async () => [
      { id: 1, finished: true },
      { id: 2, finished: true },
      { id: 3, finished: false }
    ],
    history: async () => history,
    picks: async () => [{ element: 1, position: 1, multiplier: 2, isCaptain: true }],
    fixtures: async () => [],
    ...overrides
  });

  it("saves every finished unsaved week for every member, then does nothing on rerun", async () => {
    const store = fakeStore();
    expect(await runSnapshotJob(store, fpl())).toEqual({ users: 2, saved: 4, failed: 0 });
    expect(await runSnapshotJob(store, fpl())).toEqual({ users: 2, saved: 0, failed: 0 });
  });

  it("keeps going when one member fails and retries them next run", async () => {
    const store = fakeStore();
    const flaky = fpl({
      history: async (teamId) => {
        if (teamId === 111) throw new Error("fpl down");
        return history;
      }
    });
    expect(await runSnapshotJob(store, flaky)).toEqual({ users: 2, saved: 2, failed: 1 });
    expect(await runSnapshotJob(store, fpl())).toEqual({ users: 2, saved: 2, failed: 0 });
  });

  it("skips weeks FPL has no history row for without counting a failure", async () => {
    const store = fakeStore();
    const lateJoiner = fpl({ history: async () => ({ current: [history.current[1]], chips: [] }) });
    expect(await runSnapshotJob(store, lateJoiner)).toEqual({ users: 2, saved: 2, failed: 0 });
  });
});

describe("isValidCronSecret", () => {
  it("accepts only an exact match", () => {
    expect(isValidCronSecret("abc", "abc")).toBe(true);
    expect(isValidCronSecret("abd", "abc")).toBe(false);
    expect(isValidCronSecret("ab", "abc")).toBe(false);
    expect(isValidCronSecret(null, "abc")).toBe(false);
    expect(isValidCronSecret("abc", undefined)).toBe(false);
  });
});

describe("input schemas", () => {
  it("normalises signup input and bounds it", () => {
    expect(signupSchema.parse({ email: " A@B.co ", password: "password1", teamId: "123" })).toEqual({
      email: "a@b.co",
      password: "password1",
      teamId: 123
    });
    expect(signupSchema.safeParse({ email: "a@b.co", password: "short", teamId: 1 }).success).toBe(false);
    expect(signupSchema.safeParse({ email: "a@b.co", password: "password1", teamId: 0 }).success).toBe(false);
  });
  it("limits gameweek and note length", () => {
    expect(notesSchema.safeParse({ gw: 39 }).success).toBe(false);
    expect(notesSchema.safeParse({ gw: 1, review: "x".repeat(4001) }).success).toBe(false);
    expect(notesSchema.parse({ gw: 3 })).toMatchObject({ gw: 3, review: "", plan: "" });
  });
});
