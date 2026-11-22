import { describe, expect, it } from "vitest";
import { buildLineups, FORMATIONS, type LineupPlayer } from "@/lib/xp/lineup";

// Issue #43 stage 1-A: starting XI candidates. Small squads solved by hand.
// Types: 1 GK, 2 DEF, 3 MID, 4 FWD.
type Row = [id: number, type: number, xp: number];
const players = (rows: Row[], starters: number[] = []): LineupPlayer[] =>
  rows.map(([id, elementType, xp]) => ({ id, elementType, xp, isStarter: starters.includes(id) }));

/** 2 GK, 5 DEF, 5 MID, 3 FWD. IDs: GK 1-2, DEF 11-15, MID 21-25, FWD 31-33. */
const BASE: Row[] = [
  [1, 1, 4], [2, 1, 2],
  [11, 2, 5], [12, 2, 4], [13, 2, 3], [14, 2, 2], [15, 2, 1],
  [21, 3, 8], [22, 3, 6], [23, 3, 5], [24, 3, 3], [25, 3, 1],
  [31, 4, 7], [32, 4, 4], [33, 4, 2]
];

const typeOf = (id: number) => BASE.find((row) => row[0] === id)![1];

describe("buildLineups", () => {
  it("lists exactly the eight legal formations", () => {
    expect(FORMATIONS).toHaveLength(8);
    for (const [d, m, f] of FORMATIONS) {
      expect(d).toBeGreaterThanOrEqual(3);
      expect(d).toBeLessThanOrEqual(5);
      expect(m).toBeGreaterThanOrEqual(2);
      expect(m).toBeLessThanOrEqual(5);
      expect(f).toBeGreaterThanOrEqual(1);
      expect(f).toBeLessThanOrEqual(3);
      expect(d + m + f).toBe(10);
    }
  });

  it("picks the best formations by hand-worked sums and respects every position limit", () => {
    // GK 4. Sorted: DEF 5,4,3,2,1  MID 8,6,5,3,1  FWD 7,4,2.
    // 3-4-3: 12+22+13=47  3-5-2: 12+23+11=46  4-3-3: 14+19+13=46  4-4-2: 14+22+11=47
    // 4-5-1: 14+23+7=44   5-2-3: 15+14+13=42  5-3-2: 15+19+11=45  5-4-1: 15+22+7=44
    // Plus the keeper's 4: 51, 51, then a 50 tie.
    const [first, second, third] = buildLineups(players(BASE));
    expect(first.expectedPoints).toBeCloseTo(51);
    expect(second.expectedPoints).toBeCloseTo(51);
    expect(third.expectedPoints).toBeCloseTo(50);
    // Equal totals go to the formation listed first.
    expect([first.formation, second.formation, third.formation]).toEqual(["3-4-3", "4-4-2", "3-5-2"]);
    expect([first.rank, second.rank, third.rank]).toEqual([1, 2, 3]);

    for (const lineup of [first, second, third]) {
      expect(lineup.starters).toHaveLength(11);
      expect(new Set([...lineup.starters, ...lineup.bench]).size).toBe(15);
      const count = (type: number) => lineup.starters.filter((id) => typeOf(id) === type).length;
      expect(count(1)).toBe(1);
      expect(count(2)).toBeGreaterThanOrEqual(3);
      expect(count(3)).toBeGreaterThanOrEqual(2);
      expect(count(4)).toBeGreaterThanOrEqual(1);
    }
  });

  it("starts the better keeper and benches the spare one first, then three outfielders by xP", () => {
    const [best] = buildLineups(players(BASE));
    // 3-4-3 starts DEF 11-13, MID 21-24, FWD 31-33; left over: GK 2, DEF 14, DEF 15, MID 25.
    expect(best.starters[0]).toBe(1);
    expect(best.bench).toEqual([2, 14, 15, 25]);
  });

  it("takes three forwards when they are far ahead", () => {
    const strikers: Row[] = [
      [1, 1, 3], [2, 1, 1],
      [11, 2, 3], [12, 2, 3], [13, 2, 3], [14, 2, 2], [15, 2, 2],
      [21, 3, 2], [22, 3, 2], [23, 3, 1], [24, 3, 1], [25, 3, 1],
      [31, 4, 9], [32, 4, 8], [33, 4, 7]
    ];
    const [best] = buildLineups(players(strikers));
    expect(best.starters).toEqual(expect.arrayContaining([31, 32, 33]));
  });

  it("breaks equal xP by the lower player ID, whatever the input order", () => {
    const flat: Row[] = [
      [2, 1, 1], [1, 1, 1],
      [15, 2, 1], [14, 2, 1], [13, 2, 1], [12, 2, 1], [11, 2, 1],
      [25, 3, 1], [24, 3, 1], [23, 3, 1], [22, 3, 1], [21, 3, 1],
      [33, 4, 1], [32, 4, 1], [31, 4, 1]
    ];
    const forward = buildLineups(players(flat));
    expect(buildLineups(players([...flat].reverse()))).toEqual(forward);
    expect(forward[0].formation).toBe("3-4-3");
    expect(forward[0].starters).toEqual([1, 11, 12, 13, 21, 22, 23, 24, 31, 32, 33]);
    expect(forward[0].bench).toEqual([2, 14, 15, 25]);
  });

  it("returns fewer candidates when the squad cannot field every formation, and none for no squad", () => {
    // Only 2 midfielders and 3 forwards among the field players: only formations with m=2 fit... plus extras.
    const thin: Row[] = [
      [1, 1, 3], [2, 1, 1],
      [11, 2, 5], [12, 2, 4], [13, 2, 3], [14, 2, 2], [15, 2, 1],
      [21, 3, 4], [22, 3, 3],
      [31, 4, 7], [32, 4, 6], [33, 4, 5], [34, 4, 1], [35, 4, 1], [36, 4, 1]
    ];
    const result = buildLineups(players(thin));
    expect(result.length).toBeGreaterThan(0);
    for (const lineup of result) {
      const [, m] = lineup.formation.split("-").map(Number);
      expect(m).toBe(2);
    }
    expect(buildLineups([])).toEqual([]);
  });
});

describe("buildLineups changes against the current XI", () => {
  it("has none, and a zero gain, when the current XI already is the recommendation", () => {
    const [best] = buildLineups(players(BASE));
    const [again] = buildLineups(players(BASE, best.starters));
    expect(again.changes).toEqual([]);
    expect(again.gain).toBeCloseTo(0);
  });

  it("pairs a benched star with the weak player he replaces, and reports the gain", () => {
    const [best] = buildLineups(players(BASE));
    // Same XI except MID 25 (xP 1) plays instead of MID 21 (xP 8).
    const current = best.starters.map((id) => (id === 21 ? 25 : id));
    const [lineup] = buildLineups(players(BASE, current));
    expect(lineup.changes).toEqual([{ out: 25, in: 21 }]);
    expect(lineup.gain).toBeCloseTo(7);
    expect(lineup.currentExpectedPoints).toBeCloseTo(lineup.expectedPoints - 7);
  });

  it("pairs across positions when the best formation differs from the current one", () => {
    // Current: 3-4-3 with the forward 33 (xP 2) replaced by defender 14 (xP 2): a 4-4-2 shape.
    const current = [1, 11, 12, 13, 21, 22, 23, 24, 31, 32, 14];
    const [lineup] = buildLineups(players(BASE, current));
    expect(lineup.changes).toHaveLength(1);
    expect(current).toContain(lineup.changes[0].out);
    expect(current).not.toContain(lineup.changes[0].in);
  });
});
