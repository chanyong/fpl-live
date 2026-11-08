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

const AUTH_FRAGMENT_KEYS = ["access_token", "refresh_token", "error", "error_code"];

/**
 * Reads the mail-link fragment and removes it from the address bar whenever it carries any auth parameter,
 * whatever its type (a re-sent signup link also brings access_token and refresh_token).
 */
export function consumeAuthHash(
  location: { hash: string; pathname: string; search: string },
  history: { replaceState: (data: null, unused: string, url: string) => void }
): RecoveryHash {
  const params = new URLSearchParams(location.hash.replace(/^#/, ""));
  if (AUTH_FRAGMENT_KEYS.some((key) => params.has(key))) {
    history.replaceState(null, "", location.pathname + location.search);
  }
  return parseRecoveryHash(location.hash);
}
