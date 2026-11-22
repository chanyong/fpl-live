import { NextRequest } from "next/server";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { AiInput } from "@/lib/ai/input-bundle";
import { MONTHLY_CAP_USD } from "@/lib/ai/config";
import { readBudgetNotice, resetBudgetNoticeLog, type AiDeps } from "@/lib/ai/recommend";
import { resetEntryRequestLimits } from "@/lib/entry-request-limit";
import { DISABLED, FakeStore, NOW, TEAM, makeAiInput, makeDeps } from "./helpers/ai";

const state = vi.hoisted(() => ({ deps: null as unknown as AiDeps }));
vi.mock("@/lib/ai/runtime", () => ({ getAiDeps: () => state.deps }));

import { GET } from "@/app/api/entry-ai/route";

// Issue #43 stage 5: the 80% notice. The server says only "near_limit" or null: no amount, no token count.
let input: AiInput;
beforeAll(async () => {
  input = (await makeAiInput()).input;
});
beforeEach(() => {
  resetEntryRequestLimits();
  resetBudgetNoticeLog();
});
afterEach(() => vi.restoreAllMocks());

const depsWith = (store: FakeStore) => makeDeps({ input, store }).deps;
const at = (usage: number) => {
  const store = new FakeStore();
  store.monthUsageOverride = usage;
  return store;
};

describe("readBudgetNotice", () => {
  it("is null just under 80% of the month's cap and near_limit from 80% on", async () => {
    expect(MONTHLY_CAP_USD).toBe(40);
    expect(await readBudgetNotice(depsWith(at(0)))).toBeNull();
    // 79.9% of 40 is 31.96; 80% is exactly 32.
    expect(await readBudgetNotice(depsWith(at(31.96)))).toBeNull();
    expect(await readBudgetNotice(depsWith(at(31.99)))).toBeNull();
    expect(await readBudgetNotice(depsWith(at(32)))).toBe("near_limit");
    expect(await readBudgetNotice(depsWith(at(40)))).toBe("near_limit");
    expect(await readBudgetNotice(depsWith(at(48)))).toBe("near_limit");
  });

  it("counts reserved and settled usage together, read from the usage rows", async () => {
    const store = new FakeStore();
    for (let i = 0; i < 3; i += 1) {
      const started = await store.startJob({ entryId: TEAM, targetGw: 12 + i, locale: "ko", kind: "first", inputHash: "h", modelId: "m", modelVersion: "xp1", basis: {}, reserveUsd: 0.96 });
      expect(started.ok).toBe(true);
    }
    // 33 dollars in the current month: past 80% of 40.
    store.usage.forEach((row) => (row.cost = 11));
    expect(await readBudgetNotice(depsWith(store))).toBe("near_limit");
    store.usage.forEach((row) => (row.cost = 10));
    expect(await readBudgetNotice(depsWith(store))).toBeNull();
  });

  it("is null when there is no store or the read fails (a courtesy, never an error)", async () => {
    expect(await readBudgetNotice(makeDeps({ input, config: DISABLED, store: null, client: null }).deps)).toBeNull();
    const failing = at(40);
    failing.failOn = "month-usage";
    expect(await readBudgetNotice(depsWith(failing))).toBeNull();
  });

  it("logs the code once a day per process, without an amount", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    let now = NOW;
    const deps = { ...depsWith(at(35)), now: () => now };
    await readBudgetNotice(deps);
    await readBudgetNotice(deps);
    expect(error.mock.calls).toEqual([["[entry-ai] budget_80"]]);
    now += 24 * 3_600_000;
    await readBudgetNotice(deps);
    expect(error).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(error.mock.calls)).not.toMatch(/35|\$/);

    // Under 80%: nothing is logged.
    error.mockClear();
    resetBudgetNoticeLog();
    await readBudgetNotice(depsWith(at(10)));
    expect(error).not.toHaveBeenCalled();
  });
});

describe("GET /api/entry-ai carries budgetNotice", () => {
  const get = () => new NextRequest(`http://localhost/api/entry-ai?entryId=${TEAM}&locale=ko`);

  it("near_limit at 80%, null below it, and never an amount", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    state.deps = depsWith(at(32));
    expect(await (await GET(get())).json()).toEqual({ status: "none", budgetNotice: "near_limit" });

    state.deps = depsWith(at(31.96));
    expect(await (await GET(get())).json()).toEqual({ status: "none", budgetNotice: null });
  });

  it("is null when the usage cannot be read, and the status is still answered", async () => {
    const failing = at(40);
    failing.failOn = "month-usage";
    state.deps = depsWith(failing);
    const response = await GET(get());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "none", budgetNotice: null });
  });

  it("leaves the field out when the layer is off or the team is not allowed (nothing is read)", async () => {
    state.deps = makeDeps({ input, config: DISABLED, store: null, client: null }).deps;
    expect(await (await GET(get())).json()).toEqual({ status: "disabled" });
    state.deps = depsWith(at(40));
    const other = await GET(new NextRequest("http://localhost/api/entry-ai?entryId=5&locale=ko"));
    expect(await other.json()).toEqual({ status: "not_allowed" });
  });
});
