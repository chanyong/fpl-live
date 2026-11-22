/**
 * Team IDs allowed to use the AI layer, and the recommendation panel on /team/[id] (issue #43). A code constant on
 * purpose: it cannot be widened by an environment variable. It sits in a file of its own, with no imports, so the
 * browser bundle can read it without pulling in the SDK, the store or the rest of lib/ai.
 */
export const ALLOWED_ENTRY_IDS: readonly number[] = [4300767];

export function isAllowedEntry(entryId: number) {
  return ALLOWED_ENTRY_IDS.includes(entryId);
}
