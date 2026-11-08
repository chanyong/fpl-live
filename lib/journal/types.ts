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
  signUp(email: string, password: string): Promise<{ user: JournalUser } | { error: string }>;
  signIn(email: string, password: string): Promise<{ accessToken: string; user: JournalUser } | { error: string }>;
  deleteUser(userId: string): Promise<void>;
  teamTaken(teamId: number): Promise<boolean>;
  getUser(accessToken: string): Promise<JournalUser | null>;
  /** Returns false if the team id is already registered. */
  createProfile(userId: string, teamId: number): Promise<boolean>;
  getProfile(userId: string): Promise<{ teamId: number } | null>;
  listProfiles(): Promise<Array<{ userId: string; teamId: number }>>;
  listSnapshots(userId: string, accessToken: string): Promise<Array<{ gw: number; snapshot: unknown }>>;
  savedGws(userId: string): Promise<number[]>;
  saveSnapshot(userId: string, gw: number, snapshot: unknown): Promise<void>;
  listNotes(userId: string, accessToken: string): Promise<JournalNotes[]>;
  saveNotes(userId: string, accessToken: string, notes: JournalNotes): Promise<void>;
}
