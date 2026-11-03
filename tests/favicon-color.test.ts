import { readFileSync } from "node:fs";
import path from "node:path";
import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";

// The icons are a white "F" on the site's main green (--accent in app/globals.css).
const ACCENT = "58,98,48"; // #3a6230
const OLD_GREEN = "11,110,79"; // #0b6e4f, the colour before the #8 redesign

/** Decodes an 8-bit, non-interlaced RGBA PNG (what the icon files are) into "r,g,b" strings of opaque pixels. */
function opaquePixels(png: Buffer): string[] {
  expect(png.subarray(1, 4).toString("latin1")).toBe("PNG");
  let offset = 8;
  let width = 0;
  let height = 0;
  const data: Buffer[] = [];
  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.subarray(offset + 4, offset + 8).toString("latin1");
    const body = png.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      expect([body[8], body[9], body[12]]).toEqual([8, 6, 0]);
    } else if (type === "IDAT") {
      data.push(body);
    }
    offset += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(data));
  const stride = width * 4;
  const out = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x += 1) {
      const value = raw[y * (stride + 1) + 1 + x];
      const left = x >= 4 ? out[y * stride + x - 4] : 0;
      const up = y > 0 ? out[(y - 1) * stride + x] : 0;
      const upLeft = x >= 4 && y > 0 ? out[(y - 1) * stride + x - 4] : 0;
      let predictor = 0;
      if (filter === 1) predictor = left;
      else if (filter === 2) predictor = up;
      else if (filter === 3) predictor = (left + up) >> 1;
      else if (filter === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - upLeft);
        predictor = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
      }
      out[y * stride + x] = (value + predictor) & 0xff;
    }
  }
  const pixels: string[] = [];
  for (let i = 0; i < out.length; i += 4) {
    if (out[i + 3] === 255) pixels.push(`${out[i]},${out[i + 1]},${out[i + 2]}`);
  }
  return pixels;
}

function icoFrames(ico: Buffer): Buffer[] {
  const count = ico.readUInt16LE(4);
  return Array.from({ length: count }, (_, i) => {
    const entry = 6 + i * 16;
    const size = ico.readUInt32LE(entry + 8);
    const start = ico.readUInt32LE(entry + 12);
    return ico.subarray(start, start + size);
  });
}

function mostCommon(pixels: string[]): string {
  const counts = new Map<string, number>();
  for (const p of pixels) counts.set(p, (counts.get(p) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

const read = (file: string) => readFileSync(path.join(__dirname, "..", "app", file));

describe("favicon colour", () => {
  const images: [string, Buffer][] = [
    ["icon.png", read("icon.png")],
    ["apple-icon.png", read("apple-icon.png")],
    ...icoFrames(read("favicon.ico")).map((frame, i): [string, Buffer] => [`favicon.ico frame ${i}`, frame])
  ];

  it("has every favicon.ico size", () => {
    expect(icoFrames(read("favicon.ico"))).toHaveLength(4);
  });

  it.each(images)("%s uses the site green, not the old one", (_name, png) => {
    const pixels = opaquePixels(png);
    expect(mostCommon(pixels)).toBe(ACCENT);
    expect(pixels).not.toContain(OLD_GREEN);
  });

  it("matches --accent in globals.css", () => {
    const css = readFileSync(path.join(__dirname, "..", "app", "globals.css"), "utf8");
    expect(css).toMatch(/--accent:\s*#3a6230;/i);
  });
});
