import { vi } from "vitest";
import type { AiCallResponse, AiClient } from "@/lib/ai/anthropic-client";
import { maxCostPerCallUsd } from "@/lib/ai/budget";
import type { AiConfig } from "@/lib/ai/config";
import { buildAiInput, type AiInput } from "@/lib/ai/input-bundle";
import type { PlayerMetaMap } from "@/lib/ai/players";
import type { AiDeps } from "@/lib/ai/recommend";
import {
  AiStoreError,
  DEFAULT_CAPS,
  type AiStore,
  type JobKey,
  type LatestJobs,
  type RefusalReason,
  type ReserveResult,
  type StartJobParams,
  type StartJobResult,
  type StoredJob
} from "@/lib/ai/store";
import { ASSUMPTIONS, type EntryRecommendPayload, type RecommendPlayer } from "@/lib/xp/recommend";
import { buildCaptainCandidates } from "@/lib/xp/captain";
import { buildLineups } from "@/lib/xp/lineup";
import { searchTransfers } from "@/lib/xp/transfer-search";
import { baseSquadSpecs, mkInput, mkTable, OWN_IDS, type Spec } from "./xp-transfer";

export const TEAM = 4300767;
export const NOW = Date.parse("2026-11-22T12:00:00Z");

const POSITION: Record<number, "GKP" | "DEF" | "MID" | "FWD"> = { 1: "GKP", 2: "DEF", 3: "MID", 4: "FWD" };

/** A small but real world: the own 15 (MID 21 is a dud), a few outside players, real lineups, captains and transfer scenarios. */
export async function makeAiInput(locale: "ko" | "en" = "ko"): Promise<{ input: AiInput; payload: EntryRecommendPayload }> {
  const specs: Spec[] = [
    ...baseSquadSpecs({ 21: 0, 22: 6, 31: 7 }),
    { id: 41, type: 3, team: 41, cost: 50, xp: 6 },
    { id: 42, type: 3, team: 42, cost: 51, xp: 9, likelihood: 5 },
    { id: 43, type: 2, team: 43, cost: 45, xp: 4 },
    { id: 44, type: 4, team: 44, cost: 60, xp: 5 }
  ];
  const table = mkTable(specs);
  const result = (await searchTransfers(mkInput(specs, { bank: 1 }), { sliceMs: 1_000 })).result;

  const players: RecommendPlayer[] = OWN_IDS.map((id, index) => {
    const row = table.players.get(id)!;
    return {
      elementId: id,
      webName: `Zorro${id}`,
      teamShortName: `T${id}`,
      position: POSITION[row.elementType],
      status: row.status,
      isStarter: index < 11,
      xpNext: row.next,
      xp3: row.sum3,
      xp5: row.sum5,
      availability: row.availability,
      nextFixtures: [{ opponent: "ARS", home: true, difficulty: 2 }]
    };
  });
  const lineups = buildLineups(
    players.map((player) => ({ id: player.elementId, elementType: table.players.get(player.elementId)!.elementType, xp: player.xpNext, isStarter: player.isStarter }))
  );
  const byId = new Map(players.map((player) => [player.elementId, player]));
  const captains = buildCaptainCandidates(
    lineups[0].starters.map((id) => ({ id, xp: byId.get(id)!.xpNext, fixtures: [{ opponent: "ARS", home: true }], selectedByPercent: 5 }))
  );

  const payload: EntryRecommendPayload = {
    entryId: TEAM,
    modelVersion: "xp1",
    targetGw: table.targetGw,
    squadGw: table.targetGw - 1,
    squadFetchedAt: NOW,
    xpBuiltAt: table.builtAt,
    players,
    lineups,
    captains,
    assumptions: ASSUMPTIONS,
    transfers: result,
    // What /api/entry-recommend adds for the players a scenario moves.
    playerInfo: Object.fromEntries(
      [...new Set(result.scenarios.flatMap((scenario) => [...scenario.out, ...scenario.in]))]
        .sort((a, b) => a - b)
        .map((id) => {
          const spec = specs.find((item) => item.id === id)!;
          return [String(id), { webName: `Zorro${id}`, teamShortName: `T${id}`, position: POSITION[spec.type], nowCost: spec.cost }];
        })
    )
  };

  const meta: PlayerMetaMap = new Map(
    specs.map((spec) => [spec.id, { name: `Zorro${spec.id}`, teamShort: `T${spec.id}`, position: POSITION[spec.type] }])
  );
  return { input: buildAiInput({ payload, table, meta, locale }), payload };
}

/** A model answer that passes validation for `input`: uses the first lineup, the rank-1 captain and the first scenario. */
export function validAnswer(input: AiInput, override: Record<string, unknown> = {}) {
  const captain = input.context.captainIds[0];
  const other = input.context.captainIds[1];
  return {
    summary: `Start {p${captain}} and keep the rest steady.`,
    lineup: { option_id: input.context.lineupOptionIds[0], reason: `The recommended eleven has {p${captain}} in it.` },
    captain: [
      { rank: 1, player_id: captain, reason: "Best fixture of the five.", risk: "Could be rested." },
      { rank: 2, player_id: other, reason: "A close second.", risk: "Tougher opponent." }
    ],
    transfers: input.context.scenarioIds.slice(0, 2).map((id, index) => ({
      priority: index + 1,
      scenario_id: id,
      reason: "A small gain for the cost.",
      risk: "Prices may move.",
      confidence: "medium"
    })),
    chip_note: "Hold the chips for now.",
    watch_list: [{ player_id: captain, note: "Check {p" + captain + "} news before the deadline." }],
    disagreements: [],
    ...override
  };
}

export const answerText = (value: unknown) => JSON.stringify(value);

export function okResponse(text: string, usage: Partial<AiCallResponse["usage"]> = {}): AiCallResponse {
  return { stopReason: "end_turn", text, usage: { input: 10_000, output: 8_000, cacheRead: 0, cacheWrite: 0, ...usage } };
}

/** A response that arrives when the test says so (the call stays "running" until then). */
export function deferred() {
  let resolve!: (value: AiCallResponse) => void;
  const promise = new Promise<AiCallResponse>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

export class FakeClient implements AiClient {
  calls = 0;
  requests: Array<{ system: string; user: string }> = [];
  constructor(private readonly queue: Array<AiCallResponse | Error | Promise<AiCallResponse>>) {}
  async generate(request: { system: string; user: string }) {
    this.calls += 1;
    this.requests.push(request);
    const next = this.queue.shift();
    if (!next) throw new Error("FakeClient: no response queued");
    if (next instanceof Error) throw next;
    return next;
  }
}

type FakeJob = StoredJob & { key: JobKey; created: number };
type FakeUsage = { id: string; jobId: string; reserved: number; cost: number; status: string; created: number };

/** The store's rules in memory (the real ones are SQL: see db/migrations/0002). Enough to drive the flow; not a proof of the SQL. */
export class FakeStore implements AiStore {
  jobs: FakeJob[] = [];
  usage: FakeUsage[] = [];
  /** Force the next startJob / reserveUsage to refuse with this reason. */
  refuse: RefusalReason | null = null;
  /** Throw AiStoreError from this operation. */
  failOn: string | null = null;
  startCalls = 0;
  private seq = 0;

  constructor(private readonly clock: () => number = () => NOW) {}

  private guard(operation: string) {
    if (this.failOn === operation) throw new AiStoreError(operation, 503);
  }

  private keyEq(a: JobKey, b: JobKey) {
    return a.entryId === b.entryId && a.targetGw === b.targetGw && a.locale === b.locale;
  }

  async sweepStale(key: JobKey, olderThanIso: string) {
    this.guard("sweep");
    for (const job of this.jobs) {
      if (this.keyEq(job.key, key) && job.status === "running" && job.created < Date.parse(olderThanIso)) {
        job.status = "failed";
        job.failureCode = "timeout";
      }
    }
  }

  async latest(key: JobKey): Promise<LatestJobs> {
    this.guard("latest");
    const rows = this.jobs.filter((job) => this.keyEq(job.key, key)).sort((a, b) => b.created - a.created || b.generation - a.generation);
    return {
      running: rows.find((job) => job.status === "running") ?? null,
      done: rows.find((job) => job.status === "done") ?? null,
      failed: rows.find((job) => job.status === "failed") ?? null
    };
  }

  private spent() {
    return this.usage.reduce((sum, row) => sum + row.cost, 0);
  }

  private budgetRefusal(reserve: number): RefusalReason | null {
    if (this.refuse) return this.refuse;
    if (this.spent() + reserve > DEFAULT_CAPS.monthUsd) return "month_limit";
    if (this.spent() + reserve > DEFAULT_CAPS.dayUsd) return "day_limit";
    if (this.usage.length >= DEFAULT_CAPS.dayCalls) return "day_calls_limit";
    return null;
  }

  async startJob(params: StartJobParams): Promise<StartJobResult> {
    this.guard("start");
    this.startCalls += 1;
    const key: JobKey = { entryId: params.entryId, targetGw: params.targetGw, locale: params.locale };
    const same = this.jobs.filter((job) => this.keyEq(job.key, key));
    if (same.some((job) => job.status === "running")) return { ok: false, reason: "busy" };
    if (params.kind === "first" && same.some((job) => job.status === "done")) return { ok: false, reason: "exists" };
    if (same.length >= DEFAULT_CAPS.maxGenerations) return { ok: false, reason: "regen_limit" };
    if (params.kind === "manual" && same.filter((job) => job.kind === "manual" && this.clock() - job.created < 86_400_000).length >= DEFAULT_CAPS.manualPerDay) {
      return { ok: false, reason: "regen_limit" };
    }
    const refusal = this.budgetRefusal(params.reserveUsd);
    if (refusal) return { ok: false, reason: refusal };

    this.seq += 1;
    const job: FakeJob = {
      id: `job-${this.seq}`,
      key,
      created: this.clock(),
      generation: same.length + 1,
      kind: params.kind,
      status: "running",
      result: null,
      basis: params.basis,
      failureCode: null,
      modelId: params.modelId,
      modelVersion: params.modelVersion,
      createdAt: new Date(this.clock()).toISOString(),
      completedAt: null
    };
    this.jobs.push(job);
    const usageId = this.addUsage(job.id, params.reserveUsd);
    return { ok: true, jobId: job.id, usageId, generation: job.generation };
  }

  private addUsage(jobId: string, reserve: number) {
    this.seq += 1;
    const id = `usage-${this.seq}`;
    this.usage.push({ id, jobId, reserved: reserve, cost: reserve, status: "reserved", created: this.clock() });
    return id;
  }

  async reserveUsage(jobId: string, reserveUsd: number): Promise<ReserveResult> {
    this.guard("reserve");
    const job = this.jobs.find((item) => item.id === jobId);
    if (!job || job.status !== "running") return { ok: false, reason: "job_not_running" };
    const refusal = this.budgetRefusal(reserveUsd);
    if (refusal) return { ok: false, reason: refusal };
    return { ok: true, usageId: this.addUsage(jobId, reserveUsd) };
  }

  async settleUsage(usageId: string, settled: { costUsd: number; inputTokens: number; outputTokens: number }) {
    this.guard("settle");
    const row = this.usage.find((item) => item.id === usageId)!;
    row.status = "settled";
    row.cost = settled.costUsd;
  }

  async failUsage(usageId: string) {
    this.guard("fail-usage");
    const row = this.usage.find((item) => item.id === usageId)!;
    if (row.status === "reserved") row.status = "failed";
  }

  async completeJob(jobId: string, result: unknown) {
    this.guard("complete");
    const job = this.jobs.find((item) => item.id === jobId)!;
    if (job.status === "running") {
      job.status = "done";
      job.result = result;
      job.completedAt = new Date(this.clock()).toISOString();
    }
  }

  async failJob(jobId: string, code: string) {
    this.guard("fail-job");
    const job = this.jobs.find((item) => item.id === jobId)!;
    if (job.status === "running") {
      job.status = "failed";
      job.failureCode = code;
    }
  }
}

export const ENABLED: AiConfig = { enabled: true, apiKey: "test-key", supabase: { url: "http://db.local", serviceKey: "svc" } };
export const DISABLED: AiConfig = { enabled: false, apiKey: null, supabase: null };

export function makeDeps(args: {
  store?: AiStore | null;
  client?: AiClient | null;
  input: AiInput;
  config?: AiConfig;
  targetGw?: number | null;
}): { deps: AiDeps; jobs: Array<Promise<void>>; loadInput: ReturnType<typeof vi.fn> } {
  const jobs: Array<Promise<void>> = [];
  const loadInput = vi.fn(async () => args.input);
  const deps: AiDeps = {
    config: args.config ?? ENABLED,
    store: args.store === undefined ? new FakeStore() : args.store,
    client: args.client === undefined ? new FakeClient([]) : args.client,
    loadInput,
    targetGw: async () => (args.targetGw === undefined ? args.input.basis.targetGw : args.targetGw),
    schedule: (job) => {
      jobs.push(job);
    },
    now: () => NOW
  };
  return { deps, jobs, loadInput };
}

export const RESERVATION = maxCostPerCallUsd();
