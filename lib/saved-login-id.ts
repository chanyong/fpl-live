// "Save ID" for the journal login: remembers only the email address (never a password or token) in localStorage.
export const SAVED_LOGIN_ID_KEY = "fpl-live:saved-login-id";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function defaultStorage(): StorageLike | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function readSavedLoginId(storage: StorageLike | null = defaultStorage()): string | null {
  try {
    return storage?.getItem(SAVED_LOGIN_ID_KEY) || null;
  } catch {
    return null;
  }
}

/** Call only after a successful login: stores the email when checked, removes the saved value otherwise. */
export function applySavedLoginId(email: string, remember: boolean, storage: StorageLike | null = defaultStorage()): void {
  try {
    if (!storage) return;
    if (remember && email) storage.setItem(SAVED_LOGIN_ID_KEY, email);
    else storage.removeItem(SAVED_LOGIN_ID_KEY);
  } catch {
    // Storage blocked or full: the feature is a convenience, ignore silently.
  }
}
