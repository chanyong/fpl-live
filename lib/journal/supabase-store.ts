import type { JournalNotes, JournalStore, JournalUser } from "@/lib/journal/types";

/**
 * Supabase implementation over plain fetch (GoTrue + PostgREST), so no SDK dependency is added.
 * Env names only; values live in Railway / GitHub secrets:
 *   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
 * User-scoped reads and writes go through the user's own token so row level security applies.
 * The service role key is used only for sign-up bookkeeping and the cron snapshot save.
 */
export function createSupabaseStore(env: { url: string; anonKey: string; serviceKey: string }): JournalStore {
  const base = env.url.replace(/\/$/, "");

  async function call(path: string, init: { method?: string; key: string; token?: string; body?: unknown; prefer?: string }) {
    const response = await fetch(`${base}${path}`, {
      method: init.method ?? "GET",
      headers: {
        apikey: init.key,
        Authorization: `Bearer ${init.token ?? init.key}`,
        "Content-Type": "application/json",
        ...(init.prefer ? { Prefer: init.prefer } : {})
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000)
    });
    return response;
  }

  const asUser = (raw: { id?: unknown; email?: unknown } | null): JournalUser | null =>
    raw && typeof raw.id === "string" ? { id: raw.id, email: typeof raw.email === "string" ? raw.email : "" } : null;

  const errorText = async (response: Response) => {
    const body = (await response.json().catch(() => null)) as { msg?: string; error_description?: string; message?: string } | null;
    return body?.msg ?? body?.error_description ?? body?.message ?? `status ${response.status}`;
  };

  return {
    async signUp(email, password) {
      const response = await call("/auth/v1/signup", { method: "POST", key: env.anonKey, body: { email, password } });
      if (!response.ok) return { error: await errorText(response) };
      const body = (await response.json()) as {
        user?: { id?: unknown; email?: unknown; identities?: unknown[] };
        id?: unknown;
        email?: unknown;
        identities?: unknown[];
      };
      const raw = body.user ?? body;
      const user = asUser(raw);
      if (!user) return { error: "signup failed" };
      // An already-registered email comes back as a user with an empty identities list.
      return { user, existing: Array.isArray(raw.identities) && raw.identities.length === 0 };
    },
    async signIn(email, password) {
      const response = await call("/auth/v1/token?grant_type=password", { method: "POST", key: env.anonKey, body: { email, password } });
      if (!response.ok) return { error: await errorText(response) };
      const body = (await response.json()) as { access_token?: string; user?: { id?: unknown; email?: unknown } };
      const user = asUser(body.user ?? null);
      return user && body.access_token ? { accessToken: body.access_token, user } : { error: "login failed" };
    },
    async signOut(accessToken) {
      await call("/auth/v1/logout", { method: "POST", key: env.anonKey, token: accessToken }).catch(() => undefined);
    },
    async getUser(accessToken) {
      const response = await call("/auth/v1/user", { key: env.anonKey, token: accessToken });
      return response.ok ? asUser((await response.json()) as { id?: unknown; email?: unknown }) : null;
    },
    async deleteUser(userId) {
      await call(`/auth/v1/admin/users/${encodeURIComponent(userId)}`, { method: "DELETE", key: env.serviceKey });
    },
    async teamTaken(teamId) {
      const response = await call(`/rest/v1/journal_profiles?select=user_id&fpl_team_id=eq.${teamId}&limit=1`, { key: env.serviceKey });
      return response.ok ? ((await response.json()) as unknown[]).length > 0 : true;
    },
    async createProfile(userId, teamId) {
      const response = await call("/rest/v1/journal_profiles", {
        method: "POST",
        key: env.serviceKey,
        body: { user_id: userId, fpl_team_id: teamId }
      });
      if (response.ok) return "ok";
      const body = (await response.json().catch(() => null)) as { code?: string; message?: string; details?: string } | null;
      const text = `${body?.message ?? ""} ${body?.details ?? ""}`;
      if (body?.code === "23505" && text.includes("journal_profiles_team_unique")) return "team_taken";
      console.error(`journal: profile create failed (${response.status}, ${body?.code ?? "no code"})`);
      return "error";
    },
    async getProfile(userId) {
      const response = await call(`/rest/v1/journal_profiles?select=fpl_team_id&user_id=eq.${encodeURIComponent(userId)}&limit=1`, { key: env.serviceKey });
      if (!response.ok) return null;
      const rows = (await response.json()) as Array<{ fpl_team_id: number }>;
      return rows[0] ? { teamId: rows[0].fpl_team_id } : null;
    },
    async listProfiles() {
      const response = await call("/rest/v1/journal_profiles?select=user_id,fpl_team_id", { key: env.serviceKey });
      if (!response.ok) throw new Error(`profiles read failed (${response.status})`);
      return ((await response.json()) as Array<{ user_id: string; fpl_team_id: number }>).map((row) => ({ userId: row.user_id, teamId: row.fpl_team_id }));
    },
    async listSnapshots(userId, accessToken) {
      const response = await call(`/rest/v1/journal_snapshots?select=gw,snapshot&user_id=eq.${encodeURIComponent(userId)}&order=gw.desc`, { key: env.anonKey, token: accessToken });
      if (!response.ok) throw new Error(`snapshots read failed (${response.status})`);
      return (await response.json()) as Array<{ gw: number; snapshot: unknown }>;
    },
    async savedGws(userId) {
      const response = await call(`/rest/v1/journal_snapshots?select=gw&user_id=eq.${encodeURIComponent(userId)}`, { key: env.serviceKey });
      if (!response.ok) throw new Error(`snapshots read failed (${response.status})`);
      return ((await response.json()) as Array<{ gw: number }>).map((row) => row.gw);
    },
    async saveSnapshot(userId, gw, snapshot) {
      const response = await call("/rest/v1/journal_snapshots", {
        method: "POST",
        key: env.serviceKey,
        prefer: "resolution=merge-duplicates",
        body: { user_id: userId, gw, snapshot, saved_at: new Date().toISOString() }
      });
      if (!response.ok) throw new Error(`snapshot save failed (${response.status})`);
    },
    async listNotes(userId, accessToken) {
      const response = await call(`/rest/v1/journal_notes?select=gw,review,good,bad,plan,principles&user_id=eq.${encodeURIComponent(userId)}`, { key: env.anonKey, token: accessToken });
      if (!response.ok) throw new Error(`notes read failed (${response.status})`);
      return (await response.json()) as JournalNotes[];
    },
    async saveNotes(userId, accessToken, notes) {
      const response = await call("/rest/v1/journal_notes", {
        method: "POST",
        key: env.anonKey,
        token: accessToken,
        prefer: "resolution=merge-duplicates",
        body: { user_id: userId, ...notes, updated_at: new Date().toISOString() }
      });
      if (!response.ok) throw new Error(`notes save failed (${response.status})`);
    }
  };
}

export function storeFromEnv(): JournalStore | null {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && anonKey && serviceKey ? createSupabaseStore({ url, anonKey, serviceKey }) : null;
}
