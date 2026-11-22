import { describe, expect, it } from "vitest";
import { stableStringify, SYSTEM_PROMPT } from "@/lib/ai/input-bundle";
import { makeAiInput } from "./helpers/ai";

// Issue #43 stage 2: what the model is told. Numbers and IDs only; deterministic bytes.
describe("stableStringify", () => {
  it("sorts object keys at every depth and leaves array order alone", () => {
    expect(stableStringify({ b: 1, a: { d: [3, 2, 1], c: null } })).toBe('{"a":{"c":null,"d":[3,2,1]},"b":1}');
    expect(stableStringify({ b: 1, a: 2 })).toBe(stableStringify({ a: 2, b: 1 }));
    expect(stableStringify({ a: undefined, b: 1 })).toBe('{"b":1}');
  });
});

describe("buildAiInput", () => {
  it("is deterministic: the same input gives the same bytes and hash", async () => {
    const first = (await makeAiInput()).input;
    const second = (await makeAiInput()).input;
    expect(first.user).toBe(second.user);
    expect(first.inputHash).toBe(second.inputHash);
    expect(first.inputHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("changes the hash with the language", async () => {
    const ko = (await makeAiInput("ko")).input;
    const en = (await makeAiInput("en")).input;
    expect(ko.inputHash).not.toBe(en.inputHash);
    expect(JSON.parse(en.user).meta.lang).toBe("en");
  });

  it("keeps every object's keys sorted in the user message", async () => {
    const { input } = await makeAiInput();
    const sortedKeys = (value: unknown): boolean => {
      if (Array.isArray(value)) return value.every(sortedKeys);
      if (value && typeof value === "object") {
        const keys = Object.keys(value);
        return keys.join() === [...keys].sort().join() && Object.values(value).every(sortedKeys);
      }
      return true;
    };
    // JSON.parse keeps the key order of the text, so this checks the bytes that were sent.
    expect(sortedKeys(JSON.parse(input.user))).toBe(true);
    expect(Object.keys(JSON.parse(input.user))).toEqual(["C", "L", "M", "P", "T", "X", "meta"]);
  });

  it("sends no player name, team name, manager name or news sentence", async () => {
    const { input, payload } = await makeAiInput();
    const sent = `${input.system}\n${input.user}`;
    for (const player of payload.players) {
      expect(sent).not.toContain(player.webName);
    }
    expect(sent).not.toContain("Zorro");
    expect(input.user).not.toMatch(/news|manager_name|team_name|teamName|managerName/i);
    // Identification is by ID, position number and club abbreviation.
    const bundle = JSON.parse(input.user);
    expect(bundle.P.cols).toContain("club");
    expect(bundle.P.rows).toHaveLength(15);
    expect(typeof bundle.P.rows[0][0]).toBe("number");
  });

  it("only carries a status code and numbers for availability", async () => {
    const { input } = await makeAiInput();
    const bundle = JSON.parse(input.user);
    const statusIndex = bundle.P.cols.indexOf("status");
    for (const row of bundle.P.rows) {
      expect(row[statusIndex]).toMatch(/^[adisun]$/);
    }
  });

  it("includes the pool of the transfer search, the scenarios and the lineup and captain candidates", async () => {
    const { input, payload } = await makeAiInput();
    const bundle = JSON.parse(input.user);
    expect(bundle.L.map((lineup: { id: string }) => lineup.id)).toEqual(payload.lineups.map((lineup) => `L${lineup.rank}`));
    expect(bundle.C).toHaveLength(payload.captains.length);
    expect(bundle.X.scenarios.map((scenario: { id: string }) => scenario.id)).toEqual(payload.transfers!.scenarios.map((scenario) => scenario.id));
    expect(bundle.X.recommended).toBe(payload.transfers!.recommendedId);
    const poolIds = bundle.M.rows.map((row: number[]) => row[0]);
    expect(poolIds).toEqual(expect.arrayContaining([41, 42, 43, 44]));
    // The own 15 are not in the pool.
    for (const player of payload.players) expect(poolIds).not.toContain(player.elementId);
    // R (rivals) is not part of this PR.
    expect(bundle.R).toBeUndefined();
  });

  it("builds the validation context from what was sent", async () => {
    const { input, payload } = await makeAiInput();
    expect(input.context.lineupOptionIds[0]).toBe("L1");
    expect(input.context.captainIds).toEqual(payload.captains.map((captain) => captain.id));
    expect(input.context.scenarioIds).toContain("roll");
    for (const id of [41, 42, 43, 44, 1, 33]) expect(input.context.knownPlayerIds).toContain(id);
    expect(input.context.playerNames.get(41)).toBe("Zorro41");
  });

  it("keeps the names and the rules-based numbers in the basis for the screen, not in the prompt", async () => {
    const { input } = await makeAiInput();
    expect(input.basis.playerIndex["41"]).toEqual({ name: "Zorro41", club: "T41", position: "MID" });
    expect(input.basis.lineups.length).toBeGreaterThan(0);
    expect(input.basis.captains[0].weightPct).toBeGreaterThan(0);
    expect(JSON.stringify(input.basis)).toContain("Zorro");
    expect(input.basis.promptVersion).toBe("p1");
  });

  it("tells the model the rules that the validator enforces", () => {
    expect(SYSTEM_PROMPT).toContain("{p123}");
    expect(SYSTEM_PROMPT).toMatch(/digit/i);
    expect(SYSTEM_PROMPT).toContain("meta.lang");
  });

  it("states the FPL rules of the official-rules checklist and the owner decisions", () => {
    expect(SYSTEM_PROMPT).toMatch(/2 goalkeepers, 5 defenders, 5 midfielders, 3 forwards, at most 3 from one club/);
    expect(SYSTEM_PROMPT).toMatch(/1 goalkeeper, 3 to 5 defenders, 2 to 5 midfielders, 1 to 3 forwards/);
    expect(SYSTEM_PROMPT).toMatch(/purchase price plus half the rise, rounded down/);
    // Owner decision (a): a player who fell in price sells for the current price.
    expect(SYSTEM_PROMPT).toMatch(/fell in price sells for the current price/);
    expect(SYSTEM_PROMPT).toMatch(/banked up to five/);
    expect(SYSTEM_PROMPT).toMatch(/beyond the free ones costs 4 points/);
    expect(SYSTEM_PROMPT).toMatch(/Free Hit cannot be used in two consecutive weeks/);
    // Owner decision (b): the week after a chip has exactly one free transfer.
    expect(SYSTEM_PROMPT).toMatch(/After a week with a chip the next week has exactly one free transfer/);
  
  });
});
