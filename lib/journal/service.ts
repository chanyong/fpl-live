import { timingSafeEqual } from "node:crypto";
import { buildWeeklySnapshot, getDueSnapshotGws, type SnapshotEvent, type WeeklySnapshot } from "@/lib/journal-snapshot";
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

  const created = await store.signUp(input.email, input.password);
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

export type FplSource = {
  events(): Promise<SnapshotEvent[]>;
  history(teamId: number): Promise<Parameters<typeof buildWeeklySnapshot>[0]["history"]>;
  picks(teamId: number, gw: number): Promise<Parameters<typeof buildWeeklySnapshot>[0]["picks"]>;
  fixtures(): Promise<Parameters<typeof buildWeeklySnapshot>[0]["fixtures"]>;
};

export type SnapshotJobResult = { users: number; saved: number; failed: number };

/**
 * Cron job body. For every member, saves each finished gameweek that has no row yet.
 * One member's failure never stops the others; the next run retries, which also fills missed weeks.
 */
export async function runSnapshotJob(store: JournalStore, fpl: FplSource): Promise<SnapshotJobResult> {
  const [profiles, events, fixtures] = await Promise.all([store.listProfiles(), fpl.events(), fpl.fixtures()]);
  const result: SnapshotJobResult = { users: profiles.length, saved: 0, failed: 0 };

  for (const profile of profiles) {
    try {
      const due = getDueSnapshotGws(events, await store.savedGws(profile.userId));
      if (due.length === 0) continue;
      const history = await fpl.history(profile.teamId);
      for (const gw of due) {
        try {
          // No history row (team joined mid-season or blank week): nothing to save, no picks call, not a failure.
          if (!history.current.some((row) => row.event === gw)) continue;
          const picks = await fpl.picks(profile.teamId, gw);
          const snapshot: WeeklySnapshot | null = buildWeeklySnapshot({ gw, history, picks, fixtures });
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
