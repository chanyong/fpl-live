import { siteUrl } from "@/lib/site";

/** Where Supabase mail links (recovery, confirmation) send the user back to. Must be in Supabase's redirect allow list. */
export const journalReturnUrl = () => `${siteUrl()}/journal`;

export type RecoveryHash = { kind: "recovery"; accessToken: string } | { kind: "error"; code: string } | null;

/** Reads the URL fragment GoTrue appends after the mail link (#access_token=...&type=recovery or #error_code=...). */
export function parseRecoveryHash(hash: string): RecoveryHash {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const token = params.get("access_token");
  if (params.get("type") === "recovery" && token) return { kind: "recovery", accessToken: token };
  const code = params.get("error_code");
  return code ? { kind: "error", code } : null;
}
