import { isAllowedEntry } from "@/lib/ai/allowed-entry";
import type { AiBasis } from "@/lib/ai/input-bundle";
import type { AiResult } from "@/lib/ai/schema";
import type { JobKey, LatestJobs, StoredJob } from "@/lib/ai/store";
import { buildLineups } from "@/lib/xp/lineup";
import type { EntryRecommendPayload } from "@/lib/xp/recommend";
import type { TransferScenario } from "@/lib/xp/transfer-search";

/**
 * The recommendation log (issue #43, stage 5): once per gameweek the rules-based recommendation of one team is
 * written down before the deadline, and after the gameweek is over the real points are filled in next to it.
 * It is a REFERENCE record, not a verdict: one team and one gameweek give one line, so even a whole season is
 * too small a sample for a statistical conclusion (plan 6-2, "검토 반영").
 *
 * Both halves are best-effort. Nothing here may slow a recommendation down or make it fail: a missing
 * configuration, a missing table or a failed write is skipped silently. Nothing here calls a paid API.
 * Everything outside the logic is injected (`LogDeps`); tests pass an in-memory store and fake FPL reads.
 */

export const LOG_VERSION = 1;
/** One write per (team, gameweek) per process in this window; the stored copy is the last visit's anyway. */
export const WRITE_INTERVAL_MS = 10 * 60_000;
/** Rows the screen asks for, and how many finished gameweeks one request may fill in (each costs FPL calls). */
export const LOG_LIST_LIMIT = 10;
export const FILL_PER_REQUEST = 2;

// ---------------------------------------------------------------------------------------------------------------
// Stored shapes (jsonb in ai_recommendation_log: rules_summary and actual_result)

export type LogScenario = {
  id: string;
  type: TransferScenario["type"];
  out: number[];
  in: number[];
  /** Points paid for the transfers, and the rules-based net gain over the horizon (not the real figure). */
  transferCost: number;
  netGain: number;
};

export type LogLineup = { formation: string; starters: number[]; bench: number[]; expectedPoints: number };

/** What the AI said for the same gameweek, taken from its stored answer (both resolved against ITS OWN basis). */
export type AiLogSummary = {
  generation: number;
  locale: "ko" | "en";
  /** Captain IDs, best first (at most three). */
  captains: number[];
  lineupId: string;
  lineup: LogLineup | null;
  /** The AI's first transfer priority, with the scenario it points to; null when the AI listed none. */
  transferId: string | null;
  transfer: LogScenario | null;
  recordedAt: string;
};

export type RulesSummary = {
  v: typeof LOG_VERSION;
  recordedAt: string;
  targetGw: number;
  squadGw: number | null;
  /** The target gameweek's deadline (ISO): nothing is written after it. */
  deadlineAt: string;
  /** The 15 as [player ID, FPL element type], so the best XI of the real points can be solved afterwards. */
  squad: Array<[number, number]>;
  /** Names of every player an ID below can point to (for the screen; the log is read long after the squad changed). */
  names: Record<string, string>;
  /** Captain candidates 1 to 3 of L1 with their expected points and recommendation weight. */
  captains: Array<{ id: number; xp: number; weightPct: number }>;
  /** L1 and the expected points of the squad's current XI. */
  lineup: LogLineup & { currentExpectedPoints: number };
  transfers: null | {
    freeTransfers: number;
    /** Tenths of a million. */
    bank: number;
    recommendedId: string;
    recommended: LogScenario | null;
    one: LogScenario | null;
    two: LogScenario | null;
  };
  ai?: AiLogSummary;
};

export type Comparison = "better" | "same" | "worse";

export type ActualTransfer = {
  id: string;
  type: LogScenario["type"];
  inPoints: number;
  outPoints: number;
  cost: number;
  /** Points of the incoming players, minus the outgoing players, minus the transfer cost. */
  net: number;
};

export type ActualResult = {
  v: typeof LOG_VERSION;
  computedAt: string;
  gw: number;
  captains: Array<{ id: number; points: number }>;
  /** The rules-based captain pick, and whether it scored the most among the candidates (a tie counts as the best). */
  captainTop: { id: number; points: number; bestAmongCandidates: boolean } | null;
  /** Real points of L1's eleven, of the best eleven the same 15 could have fielded, and their ratio (null when the best is 0). */
  lineup: { points: number; optimalPoints: number; ratio: number | null } | null;
  /** Real net gain of the transfers the rules recommended (null per entry when there was none or it was a chip). */
  transfers: { recommended: ActualTransfer | null; one: ActualTransfer | null; two: ActualTransfer | null } | null;
  /** What the manager really did that week. */
  manager: { captainId: number | null; captainPoints: number | null; multiplier: number | null; points: number | null; transferCost: number | null } | null;
  /** The AI's choices scored the same way, each compared with the rules-based counterpart. */
  ai?: {
    captain: { id: number; points: number; vs: Comparison } | null;
    lineup: { points: number; vs: Comparison } | null;
    transfer: { id: string; net: number; vs: Comparison } | null;
  };
};

export type LogEntryView = {
  targetGw: number;
  modelVersion: string;
  recordedAt: string;
  summary: RulesSummary;
  actual: ActualResult | null;
};

export type RecommendLogResponse = { entries: LogEntryView[] };

// ---------------------------------------------------------------------------------------------------------------
// Dependencies

export type LogRow = {
  entryId: number;
  targetGw: number;
  modelVersion: string;
  rulesSummary: unknown;
  actualResult: unknown;
  createdAt: string;
  updatedAt: string;
};

export interface LogStore {
  /** Insert or overwrite the rules summary of (team, gameweek); never touches `actual_result`. */
  upsertSummary(row: { entryId: number; targetGw: number; modelVersion: string; rulesSummary: RulesSummary }): Promise<void>;
  /** Latest gameweeks first. */
  listRecent(entryId: number, limit: number): Promise<LogRow[]>;
  /** Writes `actual_result` only where it is still null. */
  setActual(entryId: number, targetGw: number, actual: ActualResult): Promise<void>;
}

export type ActualInputs = {
  /** Real total points of every player of that gameweek (all fixtures of a double week added). */
  points: Map<number, number>;
  /** The manager's own picks that week; null when FPL gave none. */
  picks: { captainId: number | null; multiplier: number | null; points: number | null; transferCost: number | null } | null;
};

export type LogDeps = {
  /** Null when Supabase is not configured: everything is skipped. */
  store: LogStore | null;
  /** Latest stored AI jobs of a key; null when there is no AI store. */
  aiLatest: ((key: JobKey) => Promise<LatestJobs>) | null;
  /** The gameweek still open and its deadline; null when unknown (then nothing is written). */
  openDeadline: () => Promise<{ gw: number; deadlineAt: number } | null>;
  /** Gameweeks FPL marks finished; null when unknown (then nothing is filled in). */
  finishedGws: () => Promise<Set<number> | null>;
  /** One live call plus one picks call. */
  fetchActual: (entryId: number, gw: number) => Promise<ActualInputs>;
  now: () => number;
};

// ---------------------------------------------------------------------------------------------------------------
// Writing the recommendation

const POSITION_TYPE: Record<string, number> = { GKP: 1, DEF: 2, MID: 3, FWD: 4 };

const toLogScenario = (scenario: TransferScenario): LogScenario => ({
  id: scenario.id,
  type: scenario.type,
  out: [...scenario.out],
  in: [...scenario.in],
  transferCost: scenario.transferCost,
  netGain: scenario.netGain
});

const toLogLineup = (lineup: { formation: string; starters: number[]; bench: number[]; expectedPoints: number }): LogLineup => ({
  formation: lineup.formation,
  starters: [...lineup.starters],
  bench: [...lineup.bench],
  expectedPoints: lineup.expectedPoints
});

/** Pure: the rules-based summary of one recommendation. Null when there is no lineup to record. */
export function buildRulesSummary(payload: EntryRecommendPayload, deadlineAtMs: number, nowMs: number): RulesSummary | null {
  const best = payload.lineups[0];
  if (!best) {
    return null;
  }

  const captains = payload.captains.slice(0, 3).map((captain) => ({ id: captain.id, xp: captain.xp, weightPct: captain.weightPct }));
  const names: Record<string, string> = {};
  for (const player of payload.players) {
    names[String(player.elementId)] = player.webName;
  }
  const transfers = payload.transfers;
  if (transfers) {
    for (const [id, info] of Object.entries(payload.playerInfo ?? {})) {
      names[id] ??= info.webName;
    }
  }

  const scenarios = transfers?.scenarios ?? [];
  const first = (type: TransferScenario["type"]) => scenarios.find((scenario) => scenario.type === type);
  const recommended = scenarios.find((scenario) => scenario.id === transfers?.recommendedId);
  const one = first("one");
  const two = first("two");

  return {
    v: LOG_VERSION,
    recordedAt: new Date(nowMs).toISOString(),
    targetGw: payload.targetGw,
    squadGw: payload.squadGw,
    deadlineAt: new Date(deadlineAtMs).toISOString(),
    squad: payload.players.map((player) => [player.elementId, POSITION_TYPE[player.position] ?? 0]),
    names,
    captains,
    lineup: { ...toLogLineup(best), currentExpectedPoints: best.currentExpectedPoints },
    transfers: transfers
      ? {
          freeTransfers: transfers.freeTransfers,
          bank: transfers.bank,
          recommendedId: transfers.recommendedId,
          recommended: recommended ? toLogScenario(recommended) : null,
          one: one ? toLogScenario(one) : null,
          two: two ? toLogScenario(two) : null
        }
      : null
  };
}

/** The AI's answer of a stored job in log form, or null when the stored answer is not usable. Reads defensively: it is JSON from a store. */
export function summariseAi(job: StoredJob, locale: "ko" | "en", nowMs: number): AiLogSummary | null {
  const result = job.result as AiResult | null;
  const basis = (job.basis ?? {}) as Partial<AiBasis>;
  if (!result || typeof result !== "object" || !Array.isArray(result.captain) || !result.lineup) {
    return null;
  }

  const captains = [...result.captain]
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 3)
    .map((item) => item.player_id)
    .filter((id) => Number.isInteger(id));
  if (captains.length === 0) {
    return null;
  }

  const lineups = Array.isArray(basis.lineups) ? basis.lineups : [];
  const chosen = lineups.find((lineup) => `L${lineup.rank}` === result.lineup.option_id);
  const scenarios = Array.isArray(basis.transfers?.scenarios) ? basis.transfers.scenarios : [];
  const firstTransfer = Array.isArray(result.transfers) ? [...result.transfers].sort((a, b) => a.priority - b.priority)[0] : undefined;
  const scenario = firstTransfer ? scenarios.find((item) => item.id === firstTransfer.scenario_id) : undefined;

  return {
    generation: job.generation,
    locale,
    captains,
    lineupId: result.lineup.option_id,
    lineup: chosen ? toLogLineup(chosen) : null,
    transferId: firstTransfer?.scenario_id ?? null,
    transfer: scenario ? toLogScenario(scenario) : null,
    recordedAt: new Date(nowMs).toISOString()
  };
}

/** The newest finished AI answer for the gameweek in either language (Korean first on a tie). */
async function latestAiSummary(deps: LogDeps, entryId: number, targetGw: number): Promise<AiLogSummary | null> {
  if (!deps.aiLatest) {
    return null;
  }
  const found: Array<{ job: StoredJob; locale: "ko" | "en" }> = [];
  for (const locale of ["ko", "en"] as const) {
    try {
      const latest = await deps.aiLatest({ entryId, targetGw, locale });
      if (latest.done) {
        found.push({ job: latest.done, locale });
      }
    } catch {
      // The AI part is optional: a failed read leaves it out.
    }
  }
  found.sort((a, b) => Date.parse(b.job.completedAt ?? b.job.createdAt) - Date.parse(a.job.completedAt ?? a.job.createdAt));
  const newest = found[0];
  return newest ? summariseAi(newest.job, newest.locale, deps.now()) : null;
}

const lastWrite = new Map<string, number>();

/** For tests. */
export function resetRecordThrottle() {
  lastWrite.clear();
}

export type RecordOutcome = "written" | "not_allowed" | "no_store" | "throttled" | "no_deadline" | "closed" | "empty" | "failed";

/**
 * Writes the rules-based summary of one recommendation. Callers do NOT wait for it and it never throws: every
 * failure becomes an outcome. Only the allowed team is ever written, at most once per 10 minutes per (team,
 * gameweek) in this process, and never at or after the target gameweek's deadline.
 */
export async function recordRecommendation(payload: EntryRecommendPayload, deps: LogDeps): Promise<RecordOutcome> {
  try {
    if (!isAllowedEntry(payload.entryId)) return "not_allowed";
    const store = deps.store;
    if (!store) return "no_store";

    const key = `${payload.entryId}:${payload.targetGw}`;
    const now = deps.now();
    const last = lastWrite.get(key);
    if (last !== undefined && now - last < WRITE_INTERVAL_MS) return "throttled";
    // Marked before the first await: concurrent visits must not both write. A failed write is not retried for the same window.
    lastWrite.set(key, now);

    const open = await deps.openDeadline();
    if (!open || open.gw !== payload.targetGw || !Number.isFinite(open.deadlineAt)) return "no_deadline";
    if (now >= open.deadlineAt) return "closed";

    const summary = buildRulesSummary(payload, open.deadlineAt, now);
    if (!summary) return "empty";
    const ai = await latestAiSummary(deps, payload.entryId, payload.targetGw);
    if (ai) summary.ai = ai;

    await store.upsertSummary({ entryId: payload.entryId, targetGw: payload.targetGw, modelVersion: payload.modelVersion, rulesSummary: summary });
    return "written";
  } catch {
    return "failed";
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Filling in the real result

const pointsOf = (points: Map<number, number>, id: number) => points.get(id) ?? 0;
const sumOf = (points: Map<number, number>, ids: number[]) => ids.reduce((sum, id) => sum + pointsOf(points, id), 0);

function compare(ai: number, rules: number): Comparison {
  if (ai > rules) return "better";
  if (ai < rules) return "worse";
  return "same";
}

/** Real net of one scenario: points of those who came in, minus those who left, minus the transfer cost. Chips are not scored (null). */
export function actualTransfer(scenario: LogScenario | null | undefined, points: Map<number, number>): ActualTransfer | null {
  if (!scenario || scenario.type === "wildcard" || scenario.type === "freehit") {
    return null;
  }
  const inPoints = sumOf(points, scenario.in);
  const outPoints = sumOf(points, scenario.out);
  return { id: scenario.id, type: scenario.type, inPoints, outPoints, cost: scenario.transferCost, net: inPoints - outPoints - scenario.transferCost };
}

/** Pure: the real result next to a stored recommendation. Points are player points (captain doubling and automatic substitutions are not applied). */
export function computeActual(summary: RulesSummary, inputs: ActualInputs, nowMs: number): ActualResult {
  const { points, picks } = inputs;

  const captains = summary.captains.map((captain) => ({ id: captain.id, points: pointsOf(points, captain.id) }));
  const top = captains[0];
  const captainTop = top
    ? { id: top.id, points: top.points, bestAmongCandidates: top.points >= Math.max(...captains.map((captain) => captain.points)) }
    : null;

  const squadPlayers = summary.squad.map(([id, type]) => ({ id, elementType: type, xp: pointsOf(points, id), isStarter: false }));
  const optimal = buildLineups(squadPlayers, 1)[0];
  const lineupPoints = sumOf(points, summary.lineup.starters);
  const lineup = optimal
    ? { points: lineupPoints, optimalPoints: optimal.expectedPoints, ratio: optimal.expectedPoints > 0 ? lineupPoints / optimal.expectedPoints : null }
    : null;

  const transfers = summary.transfers
    ? {
        recommended: actualTransfer(summary.transfers.recommended, points),
        one: actualTransfer(summary.transfers.one, points),
        two: actualTransfer(summary.transfers.two, points)
      }
    : null;

  const result: ActualResult = {
    v: LOG_VERSION,
    computedAt: new Date(nowMs).toISOString(),
    gw: summary.targetGw,
    captains,
    captainTop,
    lineup,
    transfers,
    manager: picks
      ? {
          captainId: picks.captainId,
          captainPoints: picks.captainId === null ? null : pointsOf(points, picks.captainId),
          multiplier: picks.multiplier,
          points: picks.points,
          transferCost: picks.transferCost
        }
      : null
  };

  const ai = summary.ai;
  if (ai) {
    const aiCaptainId = ai.captains[0];
    const aiCaptain = aiCaptainId === undefined || !top ? null : { id: aiCaptainId, points: pointsOf(points, aiCaptainId), vs: compare(pointsOf(points, aiCaptainId), top.points) };
    const aiLineup = ai.lineup ? { points: sumOf(points, ai.lineup.starters), vs: compare(sumOf(points, ai.lineup.starters), lineupPoints) } : null;

    // The AI's first transfer priority against the rules-based recommendation ("roll" scores 0, a chip is not scored).
    const aiNet = actualTransfer(ai.transfer, points)?.net ?? null;
    const rulesNet = actualTransfer(summary.transfers?.recommended, points)?.net ?? null;
    const aiTransfer = ai.transfer && aiNet !== null && rulesNet !== null ? { id: ai.transfer.id, net: aiNet, vs: compare(aiNet, rulesNet) } : null;

    result.ai = { captain: aiCaptain, lineup: aiLineup, transfer: aiTransfer };
  }

  return result;
}

function isRulesSummary(value: unknown): value is RulesSummary {
  if (typeof value !== "object" || value === null) return false;
  const summary = value as Partial<RulesSummary>;
  return (
    summary.v === LOG_VERSION &&
    typeof summary.targetGw === "number" &&
    Array.isArray(summary.captains) &&
    Array.isArray(summary.squad) &&
    typeof summary.lineup === "object" &&
    summary.lineup !== null &&
    Array.isArray(summary.lineup.starters)
  );
}

function isActualResult(value: unknown): value is ActualResult {
  return typeof value === "object" && value !== null && (value as Partial<ActualResult>).v === LOG_VERSION;
}

/**
 * The newest recorded gameweeks of one team (at most 10), after filling in the real result of up to two
 * finished gameweeks that have none yet. Never throws: a failure leaves the row without a result, or the list
 * empty. The caller decides whether the team may see the log at all.
 */
export async function readRecommendationLog(entryId: number, deps: LogDeps): Promise<LogEntryView[]> {
  const store = deps.store;
  if (!store || !isAllowedEntry(entryId)) {
    return [];
  }

  let rows: LogRow[];
  try {
    rows = await store.listRecent(entryId, LOG_LIST_LIMIT);
  } catch {
    return [];
  }

  const actuals = new Map<number, ActualResult>();
  for (const row of rows) {
    if (isActualResult(row.actualResult)) actuals.set(row.targetGw, row.actualResult);
  }

  try {
    const finished = await deps.finishedGws();
    const pending = rows
      .filter((row) => !actuals.has(row.targetGw) && finished?.has(row.targetGw) && isRulesSummary(row.rulesSummary))
      .sort((a, b) => b.targetGw - a.targetGw)
      .slice(0, FILL_PER_REQUEST);

    for (const row of pending) {
      try {
        const actual = computeActual(row.rulesSummary as RulesSummary, await deps.fetchActual(entryId, row.targetGw), deps.now());
        actuals.set(row.targetGw, actual);
        try {
          await store.setActual(entryId, row.targetGw, actual);
        } catch {
          // Shown now, computed again on the next visit.
        }
      } catch {
        // FPL did not answer for this gameweek: it stays "waiting".
      }
    }
  } catch {
    // No finished-gameweek information: show what is stored.
  }

  return rows
    .filter((row) => isRulesSummary(row.rulesSummary))
    .map((row) => ({
      targetGw: row.targetGw,
      modelVersion: row.modelVersion,
      recordedAt: (row.rulesSummary as RulesSummary).recordedAt ?? row.updatedAt,
      summary: row.rulesSummary as RulesSummary,
      actual: actuals.get(row.targetGw) ?? null
    }));
}
