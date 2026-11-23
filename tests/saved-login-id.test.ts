import { describe, expect, it } from "vitest";
import { applySavedLoginId, readSavedLoginId, SAVED_LOGIN_ID_KEY } from "@/lib/saved-login-id";

const memory = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
};
const broken = {
  getItem: () => { throw new Error("blocked"); },
  setItem: () => { throw new Error("blocked"); },
  removeItem: () => { throw new Error("blocked"); }
};

describe("saved login id", () => {
  it("saves, reads and removes", () => {
    const s = memory();
    applySavedLoginId("a@b.co", true, s);
    expect(s.getItem(SAVED_LOGIN_ID_KEY)).toBe("a@b.co");
    expect(readSavedLoginId(s)).toBe("a@b.co");
    applySavedLoginId("a@b.co", false, s);
    expect(readSavedLoginId(s)).toBeNull();
  });
  it("ignores storage failures silently", () => {
    expect(() => applySavedLoginId("a@b.co", true, broken)).not.toThrow();
    expect(readSavedLoginId(broken)).toBeNull();
    expect(readSavedLoginId(null)).toBeNull();
  });
});
