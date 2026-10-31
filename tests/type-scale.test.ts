import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Issue #2: no text on screen is smaller than 13px, and sizes come from the steps in app/globals.css
// (text-caption, text-meta, ...) instead of one-off text-[Npx] classes. lib/og-card.tsx is left out:
// it draws the 1200×630 share image, not screen text.
const ROOTS = ["app", "components"];
const MIN_PX = 13;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(tsx?|css)$/.test(name) ? [full] : [];
  });
}

/** Why a line breaks the type scale; empty when it is fine. */
function typeScaleProblems(line: string): string[] {
  const problems: string[] = [];
  for (const match of line.matchAll(/(?<![\w-])text-\[\d*\.?\d+(?:px|rem|em)\]/g)) {
    problems.push(`one-off size ${match[0]}`);
  }
  if (/(?<![\w-])text-xs(?![\w-])/.test(line)) problems.push("text-xs is 12px");
  for (const match of line.matchAll(/fontSize[=:]\s*\{?\s*["']?(\d*\.?\d+)/g)) {
    if (Number(match[1]) < MIN_PX) problems.push(`fontSize ${match[1]}`);
  }
  for (const match of line.matchAll(/(?:font-size|--text-[a-z0-9-]+)\s*:\s*(\d*\.?\d+)px/g)) {
    if (Number(match[1]) < MIN_PX) problems.push(`${match[0]}`);
  }
  return problems;
}

describe("type scale (issue #2)", () => {
  it("flags the patterns it is meant to catch", () => {
    expect(typeScaleProblems('className="text-[11px] font-semibold"')).not.toEqual([]);
    expect(typeScaleProblems('className="text-[0.7rem]"')).not.toEqual([]);
    expect(typeScaleProblems('className="md:text-xs"')).not.toEqual([]);
    expect(typeScaleProblems("<text fontSize={10}>")).not.toEqual([]);
    expect(typeScaleProblems('<text fontSize="10.5">')).not.toEqual([]);
    expect(typeScaleProblems("  --text-tiny: 11px;")).not.toEqual([]);

    expect(typeScaleProblems('className="text-caption text-[var(--muted)] text-[#7a1f1f]"')).toEqual([]);
    expect(typeScaleProblems('<text fontSize={13} fontSize="16">')).toEqual([]);
  });

  it("has no text under 13px and no one-off text sizes in app/ or components/", () => {
    const problems = ROOTS.flatMap(sourceFiles).flatMap((file) =>
      readFileSync(file, "utf8")
        .split("\n")
        .flatMap((line, index) => typeScaleProblems(line).map((problem) => `${file}:${index + 1} ${problem}`))
    );

    expect(problems).toEqual([]);
  });
});
