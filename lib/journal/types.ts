import { z } from "zod";

export const signupSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(8).max(72),
  teamId: z.coerce.number().int().positive().max(100_000_000)
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(72)
});

export const emailSchema = z.object({ email: z.string().trim().toLowerCase().email().max(254) });

export const resetPasswordSchema = z.object({
  accessToken: z.string().min(20).max(4000),
  password: z.string().min(8).max(72)
});

const text = z.string().max(4000);
export const notesSchema = z.object({
  gw: z.coerce.number().int().min(1).max(38),
  review: text.default(""),
  good: text.default(""),
  bad: text.default(""),
  plan: text.default(""),
  principles: text.default("")
});
export type JournalNotes = z.infer<typeof notesSchema>;

export type JournalUser = { id: string; email: string };

/** Storage seam. The Supabase implementation and the test fake both satisfy it. */
export interface JournalStore {
  /** existing=true when the email already has an account (Supabase returns a fake user with no identities). */
  signUp(email: string, password: string): Promise<{ user: JournalUser; existing: boolean } | { error: string }>;
  signOut(accessToken: string): Promise<void>;
  /** code is GoTrue's error_code (e.g. email_not_confirmed); GoTrue only reports it after the password was right. */
  signIn(email: string, password: string): Promise<{ accessToken: string; user: JournalUser } | { error: string; code?: string }>;
  /** Sends a recovery mail. Resolves the same way for unknown emails; callers must not expose the outcome. */
  requestPasswordReset(email: string, redirectTo: string): Promise<void>;
  /** Re-sends the signup confirmation mail. Same silent behaviour as requestPasswordReset. */
  resendConfirmation(email: string, redirectTo: string): Promise<void>;
  /** Sets a new password using the recovery access token from the mail link. */
  updatePassword(accessToken: string, password: string): Promise<"ok" | "invalid_token" | "error">;
  deleteUser(userId: string): Promise<void>;
  teamTaken(teamId: number): Promise<boolean>;
  getUser(accessToken: string): Promise<JournalUser | null>;
  /** team_taken only for the unique team constraint; other failures are 'error' and must not delete the account. */
  createProfile(userId: string, teamId: number): Promise<"ok" | "team_taken" | "error">;
  getProfile(userId: string): Promise<{ teamId: number } | null>;
  listProfiles(): Promise<Array<{ userId: string; teamId: number }>>;
  listSnapshots(userId: string, accessToken: string): Promise<Array<{ gw: number; snapshot: unknown }>>;
  savedGws(userId: string): Promise<number[]>;
  saveSnapshot(userId: string, gw: number, snapshot: unknown): Promise<void>;
  listNotes(userId: string, accessToken: string): Promise<JournalNotes[]>;
  saveNotes(userId: string, accessToken: string, notes: JournalNotes): Promise<void>;
}
