import { timingSafeEqual } from "node:crypto";
import { buildWeeklySnapshot, getDueSnapshotGws, hasSnapshotDetail, mergeDetailIntoSnapshot, type SnapshotDetail, type SnapshotEvent, type WeeklySnapshot } from "@/lib/journal-snapshot";
import { journalReturnUrl } from "@/lib/journal/recovery";
import type { JournalStore } from "@/lib/journal/types";

export type SignupResult =
  | { ok: true; needsConfirmation: boolean }
  | { ok: false; code: "team_not_found" | "fpl_unavailable" | "team_taken" | "signup_failed"; message?: string };

export type TeamCheck = "found" | "missing" | "unavailable";

/** Sign-up: verify the FPL team exists, block a team that already has an account, then create the account. */
export async function signUpMember(
  store: JournalStore,
  input: { email: string; password: string; teamId: number },
  checkTeam: (teamId: number) => Promise<TeamCheck>
): Promise<SignupResult> {
  const team = await checkTeam(input.teamId);
  if (team === "missing") return { ok: false, code: "team_not_found" };
  if (team === "unavailable") return { ok: false, code: "fpl_unavailable" };
  if (await store.teamTaken(input.teamId)) return { ok: false, code: "team_taken" };

  const created = await store.signUp(input.email, input.password, journalReturnUrl());
  if ("error" in created) return { ok: false, code: "signup_failed", message: created.error };

  // Existing email: answer exactly like a new sign-up so the form cannot be used to probe for accounts,
  // and never touch that account.
  if (created.existing) return { ok: true, needsConfirmation: true };

  const saved = await store.createProfile(created.user.id, input.teamId);
  if (saved === "team_taken") {
    // Lost a race for the same team number: drop only the account we just made.
    try {
      await store.deleteUser(created.user.id);
    } catch (error) {
      console.error("journal: could not remove half-made account", error instanceof Error ? error.message : "unknown");
    }
    return { ok: false, code: "team_taken" };
  }
  // "error": keep the account (it may be someone else's unconfirmed one); same response as success.
  return { ok: true, needsConfirmation: true };
}

type BuildInput = Parameters<typeof buildWeeklySnapshot>[0];

export type FplSource = {
  events(): Promise<SnapshotEvent[]>;
  history(teamId: number): Promise<BuildInput["history"]>;
  picks(teamId: number, gw: number): Promise<{ picks: BuildInput["picks"]; autoSubs: Array<{ in: number; out: number }> }>;
  fixtures(): Promise<BuildInput["fixtures"]>;
  /** Player and club names (bootstrap-static). Fetched once per run. Optional so older callers keep working. */
  catalog?(): Promise<Pick<SnapshotDetail, "players" | "teams">>;
  /** One gameweek's live ledger (event/{gw}/live, ~450KB). Fetched once per gameweek per run, never per member. */
  live?(gw: number): Promise<SnapshotDetail["live"]>;
};

export type SnapshotJobResult = { users: number; saved: number; failed: number };

/** Run-wide FPL data shared by all members: one catalog call and one live call per gameweek. */
function createDetailLoader(fpl: FplSource, events: SnapshotEvent[]) {
  let catalog: Promise<Pick<SnapshotDetail, "players" | "teams">> | null = null;
  const live = new Map<number, Promise<SnapshotDetail["live"]>>();
  return async (gw: number, autoSubs: SnapshotDetail["autoSubs"]): Promise<SnapshotDetail | undefined> => {
    if (!fpl.catalog || !fpl.live) return undefined;
    catalog ??= fpl.catalog();
    if (!live.has(gw)) live.set(gw, fpl.live(gw));
    // A rejected promise stays cached for this run only: the same week fails once per member, not once per call.
    const [names, ledger] = await Promise.all([catalog, live.get(gw)!]);
    const event = events.find((item) => item.id === gw);
    return { ...names, live: ledger, autoSubs, average: event?.average_entry_score ?? null, highest: event?.highest_score ?? null };
  };
}

/**
 * Cron job body. For every member, saves each finished gameweek that has no row yet.
 * One member's failure never stops the others; the next run retries, which also fills missed weeks.
 */
export async function runSnapshotJob(store: JournalStore, fpl: FplSource): Promise<SnapshotJobResult> {
  const [profiles, events, fixtures] = await Promise.all([store.listProfiles(), fpl.events(), fpl.fixtures()]);
  const result: SnapshotJobResult = { users: profiles.length, saved: 0, failed: 0 };
  const loadDetail = createDetailLoader(fpl, events);

  for (const profile of profiles) {
    try {
      const due = getDueSnapshotGws(events, await store.savedGws(profile.userId));
      if (due.length === 0) continue;
      const history = await fpl.history(profile.teamId);
      for (const gw of due) {
        try {
          // No history row (team joined mid-season or blank week): nothing to save, no picks call, not a failure.
          if (!history.current.some((row) => row.event === gw)) continue;
          const { picks, autoSubs } = await fpl.picks(profile.teamId, gw);
          const detail = await loadDetail(gw, autoSubs);
          const snapshot: WeeklySnapshot | null = buildWeeklySnapshot({ gw, history, picks, fixtures, detail });
          if (!snapshot) continue;
          await store.saveSnapshot(profile.userId, gw, snapshot);
          result.saved += 1;
        } catch (error) {
          result.failed += 1;
          logFailure(profile.teamId, gw, error);
        }
      }
    } catch (error) {
      result.failed += 1;
      logFailure(profile.teamId, null, error);
    }
  }
  return result;
}

export type BackfillOptions = {
  /** Nothing is written unless this is exactly true. */
  write?: boolean;
  /** Only these gameweeks. */
  gws?: number[];
  /** Attempt only the first N member-weeks of the plan (GW ascending); failures and skipped weeks count toward N. */
  limit?: number;
};

export type BackfillResult = {
  dryRun: boolean;
  users: number;
  /** Member-weeks whose saved snapshot lacks the #27 detail. */
  targets: number;
  byGw: Record<string, number>;
  written: number;
  failed: number;
};

/**
 * Re-fills snapshots saved before issue #27 with the player ledger and match results.
 * Dry run is the default: it only reads our own store and reports what it would touch, with no FPL calls.
 * A write keeps every existing value as saved (and saved_at) and only appends the new keys (mergeDetailIntoSnapshot),
 * so undoing it is just removing those keys (see the rollback SQL in issue #27).
 */
export async function runSnapshotBackfill(store: JournalStore, fpl: FplSource, options: BackfillOptions = {}): Promise<BackfillResult> {
  const write = options.write === true;
  const only = options.gws ? new Set(options.gws) : null;
  const limit = options.limit ?? Infinity;
  const profiles = await store.listProfiles();
  const result: BackfillResult = { dryRun: !write, users: profiles.length, targets: 0, byGw: {}, written: 0, failed: 0 };
  const plan: Array<{ userId: string; teamId: number; gw: number; old: unknown }> = [];

  for (const profile of profiles) {
    try {
      for (const row of await store.snapshotsOf(profile.userId)) {
        if (hasSnapshotDetail(row.snapshot) || (only && !only.has(row.gw))) continue;
        plan.push({ userId: profile.userId, teamId: profile.teamId, gw: row.gw, old: row.snapshot });
      }
    } catch (error) {
      result.failed += 1;
      logFailure(profile.teamId, null, error);
    }
  }
  plan.sort((a, b) => a.gw - b.gw);
  result.targets = plan.length;
  for (const item of plan) result.byGw[String(item.gw)] = (result.byGw[String(item.gw)] ?? 0) + 1;
  if (!write) return result;

  const [events, fixtures] = await Promise.all([fpl.events(), fpl.fixtures()]);
  const loadDetail = createDetailLoader(fpl, events);
  const histories = new Map<number, Promise<BuildInput["history"]>>();

  for (const item of plan.slice(0, limit)) {
    try {
      if (!histories.has(item.teamId)) histories.set(item.teamId, fpl.history(item.teamId));
      const history = await histories.get(item.teamId)!;
      const { picks, autoSubs } = await fpl.picks(item.teamId, item.gw);
      const detail = await loadDetail(item.gw, autoSubs);
      if (!detail) throw new Error("backfill needs catalog and live data");
      const fresh = buildWeeklySnapshot({ gw: item.gw, history, picks, fixtures, detail });
      if (!fresh) continue;
      const old = typeof item.old === "object" && item.old !== null ? item.old : {};
      await store.saveSnapshot(item.userId, item.gw, mergeDetailIntoSnapshot(old as Record<string, unknown>, fresh), { keepSavedAt: true });
      result.written += 1;
    } catch (error) {
      result.failed += 1;
      logFailure(item.teamId, item.gw, error);
    }
  }
  return result;
}

/** Constant-time check of the cron secret header. */
export function isValidCronSecret(provided: string | null, expected: string | undefined) {
  if (!provided || !expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Team number and a status/short reason only: no tokens, emails or keys. */
function logFailure(teamId: number, gw: number | null, error: unknown) {
  const reason = error instanceof Error ? error.message.slice(0, 120) : "unknown";
  console.error(`journal snapshot failed: team ${teamId}${gw === null ? "" : ` gw ${gw}`}: ${reason}`);
}
