import { describe, expect, it } from "vitest";

// Node 25+ ships a localStorage global that hides jsdom's; vitest.setup.ts restores it.
describe("test environment storage", () => {
  it.each(["localStorage", "sessionStorage"] as const)("window.%s is a working Storage", (key) => {
    const storage = window[key];
    expect(storage).toBeInstanceOf(Storage);
    storage.setItem("probe", "1");
    expect(storage.getItem("probe")).toBe("1");
    storage.clear();
    expect(storage.length).toBe(0);
  });
});
