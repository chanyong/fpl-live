import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import nextConfig from "@/next.config";
import { viewport } from "@/app/layout";
import { GET } from "@/app/llms.txt/route";
import { llmsText } from "@/lib/llms-text";

// next/font only works inside the Next compiler; the layout is imported here for its viewport export.
vi.mock("next/font/google", () => ({ Manrope: () => ({ variable: "font-sans" }) }));

// Issue #1: SITE_RULES 1-1 (theme-color), 1-2 (Hangul font), 1-7 (llms.txt), 1-11 (security headers).
const root = path.resolve(__dirname, "..");

describe("security headers", () => {
  it("sends HSTS, nosniff, referrer, frame and permissions headers on every path", async () => {
    const rules = await nextConfig.headers!();
    const all = rules.find((rule) => rule.source === "/:path*");
    const headers = Object.fromEntries((all?.headers ?? []).map((h) => [h.key, h.value]));

    expect(headers["Strict-Transport-Security"]).toBe("max-age=63072000");
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["X-Frame-Options"]).toBe("SAMEORIGIN");
    expect(headers["Permissions-Policy"]).toContain("camera=()");
  });
});

describe("theme-color", () => {
  it("matches the primary colour token in globals.css", () => {
    const css = readFileSync(path.join(root, "app/globals.css"), "utf8");
    const accent = css.match(/--accent:\s*(#[0-9a-f]{6})/i)?.[1];
    expect(accent).toBeDefined();
    expect(viewport.themeColor).toBe(accent);
  });
});

describe("Hangul font", () => {
  it("puts Pretendard ahead of the OS fonts in the body stack", () => {
    const css = readFileSync(path.join(root, "app/globals.css"), "utf8");
    const stack = css.match(/body\s*\{[^}]*font-family:\s*([^;]+);/)?.[1].replace(/\s+/g, " ") ?? "";
    expect(stack.startsWith("var(--font-sans), \"Pretendard Variable\", Pretendard")).toBe(true);
    expect(stack.indexOf("Pretendard")).toBeLessThan(stack.indexOf("Malgun Gothic"));
  });

  it("loads the Pretendard stylesheet in the root layout", () => {
    const layout = readFileSync(path.join(root, "app/layout.tsx"), "utf8");
    expect(layout).toMatch(/pretendardvariable-dynamic-subset\.min\.css/);
    expect(layout).toMatch(/<link rel="stylesheet" href=\{PRETENDARD_CSS\}/);
  });
});

describe("llms.txt", () => {
  it("describes the site, its data source and refresh rate, and links the main pages", () => {
    const text = llmsText("https://example.test");
    expect(text.startsWith("# FPL Live\n")).toBe(true);
    expect(text).toContain("fantasy.premierleague.com");
    expect(text).toContain("30초");
    for (const page of ["/price-changes", "/faq", "/privacy", "/terms"]) {
      expect(text).toContain(`https://example.test${page}`);
    }
  });

  it("is served as UTF-8 plain text", async () => {
    const response = GET();
    expect(response.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(await response.text()).toContain("# FPL Live");
  });
});
