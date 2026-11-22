import { vi } from "vitest";
import {
  LOG_VERSION,
  type ActualInputs,
  type ActualResult,
  type LogDeps,
  type LogRow,
  type LogStore,
  type RulesSummary
} from "@/lib/ai/rec-log";
import type { LatestJobs } from "@/lib/ai/store";

export const NOW = Date.parse("2026-11-22T12:00:00Z");
export const DEADLINE = Date.parse("2026-11-27T17:30:00Z");

/** The log table in memory. `failOn` makes one operation throw, like a missing table or a dead connection. */
export class MemoryLogStore implements LogStore {
  rows = new Map<string, LogRow>();
  calls = 0;
  upserts = 0;
  failOn: "upsert" | "list" | "set-actual" | null = null;
  /** When set, an upsert never settles: proves the caller does not wait for it. */
  hang = false;

  private key(entryId: number, gw: number) {
    return `${entryId}:${gw}`;
  }

  private guard(operation: "upsert" | "list" | "set-actual") {
    this.calls += 1;
    if (this.failOn === operation) throw new Error(`memory log store ${operation} failed`);
  }

  async upsertSummary(row: { entryId: number; targetGw: number; modelVersion: string; rulesSummary: RulesSummary }) {
    this.guard("upsert");
    this.upserts += 1;
    if (this.hang) await new Promise(() => undefined);
    const key = this.key(row.entryId, row.targetGw);
    const old = this.rows.get(key);
    const stamp = new Date(NOW).toISOString();
    this.rows.set(key, {
      entryId: row.entryId,
      targetGw: row.targetGw,
      modelVersion: row.modelVersion,
      rulesSummary: row.rulesSummary,
      actualResult: old?.actualResult ?? null,
      createdAt: old?.createdAt ?? stamp,
      updatedAt: stamp
    });
  }

  async listRecent(entryId: number, limit: number) {
    this.guard("list");
    return [...this.rows.values()]
      .filter((row) => row.entryId === entryId)
      .sort((a, b) => b.targetGw - a.targetGw)
      .slice(0, limit)
      .map((row) => ({ ...row }));
  }

  async setActual(entryId: number, targetGw: number, actual: ActualResult) {
    this.guard("set-actual");
    const row = this.rows.get(this.key(entryId, targetGw));
    if (row && row.actualResult === null) row.actualResult = actual;
  }

  put(row: Partial<LogRow> & { entryId: number; targetGw: number; rulesSummary: unknown }) {
    this.rows.set(this.key(row.entryId, row.targetGw), {
      modelVersion: "xp1",
      actualResult: null,
      createdAt: "2026-11-20T10:00:00.000Z",
      updatedAt: "2026-11-20T10:00:00.000Z",
      ...row
    });
  }
}

export type DepsOptions = {
  store?: MemoryLogStore | null;
  now?: () => number;
  open?: { gw: number; deadlineAt: number } | null;
  finished?: number[] | null;
  actual?: (entryId: number, gw: number) => Promise<ActualInputs>;
  aiLatest?: LogDeps["aiLatest"];
};

export function makeLogDeps(options: DepsOptions = {}) {
  const store = options.store === undefined ? new MemoryLogStore() : options.store;
  const fetchActual = vi.fn(options.actual ?? (async () => ({ points: new Map<number, number>(), picks: null })));
  const openDeadline = vi.fn(async () => (options.open === undefined ? { gw: 12, deadlineAt: DEADLINE } : options.open));
  const finishedGws = vi.fn(async () => (options.finished === undefined ? null : options.finished === null ? null : new Set(options.finished)));
  const deps: LogDeps = {
    store,
    aiLatest: options.aiLatest ?? null,
    openDeadline,
    finishedGws,
    fetchActual,
    now: options.now ?? (() => NOW)
  };
  return { deps, store, fetchActual, openDeadline, finishedGws };
}

/**
 * A hand-solvable week. Squad types: GK 1-2, DEF 11-15, MID 21-25, FWD 31-33. L1 is 4-4-2 with the bench GK 2,
 * DEF 15, MID 25, FWD 33. Rules-based captain picks 31, 21, 22; one transfer 25 -> 41; two transfers 14+24 -> 42+43.
 */
export function mkSummary(overrides: Partial<RulesSummary> = {}): RulesSummary {
  const ids = [1, 2, 11, 12, 13, 14, 15, 21, 22, 23, 24, 25, 31, 32, 33];
  const type = (id: number) => (id < 10 ? 1 : id < 20 ? 2 : id < 30 ? 3 : 4);
  return {
    v: LOG_VERSION,
    recordedAt: "2026-11-22T12:00:00.000Z",
    targetGw: 12,
    squadGw: 11,
    deadlineAt: new Date(DEADLINE).toISOString(),
    squad: ids.map((id) => [id, type(id)]),
    names: Object.fromEntries([...ids, 41, 42, 43].map((id) => [String(id), `P${id}`])),
    captains: [
      { id: 31, xp: 7.5, weightPct: 50 },
      { id: 21, xp: 6.5, weightPct: 30 },
      { id: 22, xp: 6, weightPct: 20 }
    ],
    lineup: {
      formation: "4-4-2",
      starters: [1, 11, 12, 13, 14, 21, 22, 23, 24, 31, 32],
      bench: [2, 15, 25, 33],
      expectedPoints: 60,
      currentExpectedPoints: 55
    },
    transfers: {
      freeTransfers: 1,
      bank: 5,
      recommendedId: "one:25>41",
      recommended: { id: "one:25>41", type: "one", out: [25], in: [41], transferCost: 0, netGain: 3 },
      one: { id: "one:25>41", type: "one", out: [25], in: [41], transferCost: 0, netGain: 3 },
      two: { id: "two:14+24>42+43", type: "two", out: [14, 24], in: [42, 43], transferCost: 4, netGain: 1 }
    },
    ...overrides
  };
}

/** Real points of that week: L1's eleven add up to 50, the best eleven of the same 15 to 72. */
export function mkPoints(extra: Record<number, number> = {}) {
  return new Map<number, number>(
    Object.entries({
      1: 2, 2: 6,
      11: 1, 12: 2, 13: 3, 14: 4, 15: 9,
      21: 5, 22: 6, 23: 7, 24: 8, 25: 1,
      31: 10, 32: 2, 33: 12,
      41: 11, 42: 8, 43: 0,
      ...extra
    }).map(([id, points]) => [Number(id), points])
  );
}

export const NO_AI_JOBS: LatestJobs = { running: null, done: null, failed: null };
