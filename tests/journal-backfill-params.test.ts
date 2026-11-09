import { describe, expect, it } from "vitest";
import { parseBackfillParams } from "@/lib/journal/backfill-params";

const parse = (query: string) => parseBackfillParams(new URLSearchParams(query));

describe("parseBackfillParams", () => {
  it("defaults to a dry run with no limits", () => {
    expect(parse("mode=backfill")).toEqual({ ok: true, options: { write: false } });
    expect(parse("write=true")).toEqual({ ok: true, options: { write: false } });
  });
  it("writes only for write=1 and reads valid gws and limit", () => {
    expect(parse("write=1&gws=1,9&limit=3")).toEqual({ ok: true, options: { write: true, gws: [1, 9], limit: 3 } });
  });
  it.each(["gws=", "gws=abc", "gws=GW9", "gws=0", "gws=39", "gws=1,x", "gws=1,,2", "gws=1.5"])("rejects %s", (query) => {
    expect(parse(query)).toEqual({ ok: false, param: "gws" });
  });
  it.each(["limit=", "limit=0", "limit=one", "limit=1.5", "limit=-1"])("rejects %s", (query) => {
    expect(parse(query)).toEqual({ ok: false, param: "limit" });
  });
});
