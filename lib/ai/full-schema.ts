import { z } from "zod";
import { transferCost } from "@/lib/free-transfers";
import { checkSentence, failed, TEXT_LIMITS, type Fail } from "@/lib/ai/schema";
import { FORMATIONS } from "@/lib/xp/lineup";
import type { LineupPlayerCard, ScenarioLineup } from "@/lib/xp/recommend";

/**
 * "Full AI" mode (issue #85): the model picks the XI, the bench order, the armband, the formation and the
 * transfers (0-2, or a chip) itself, and says why for every player. Unlike the ranking mode (schema.ts) it is
 * free to choose, so the SERVER checks the FPL rules on what it chose. Any broken rule discards the whole
 * answer (one retry, then the rules engine's best option replaces it and the screen says so).
 *
 * Money is whole tenths of a million, like the transfer search. Sentences follow the same text rules as schema.ts
 * (players only as {p123} placeholders, no digit outside them, no markup).
 */

export const CHIP_CHOICES = ["none", "wildcard", "freehit"] as const;
export type ChipChoice = (typeof CHIP_CHOICES)[number];

/** Without a chip a manager may plan this many transfers (the issue: 0-2). With a chip the whole squad may move. */
export const MAX_PLAIN_TRANSFERS = 2;
export const SQUAD_SIZE = 15;
const POSITION_COUNTS: Readonly<Record<number, number>> = { 1: 2, 2: 5, 3: 5, 4: 3 };
const MAX_PER_CLUB = 3;

export const FULL_OUTPUT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "chip", "transfers", "starters", "bench", "captain_id", "vice_captain_id", "reasons"],
  properties: {
    summary: { type: "string" },
    chip: { type: "string", enum: [...CHIP_CHOICES] },
    transfers: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["out_id", "in_id"],
        properties: { out_id: { type: "integer" }, in_id: { type: "integer" } }
      }
    },
    starters: { type: "array", items: { type: "integer" } },
    bench: { type: "array", items: { type: "integer" } },
    captain_id: { type: "integer" },
    vice_captain_id: { type: "integer" },
    reasons: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["player_id", "reason"],
        properties: { player_id: { type: "integer" }, reason: { type: "string" } }
      }
    }
  }
} as const;

const shape = z
  .object({
    summary: z.string(),
    chip: z.enum(CHIP_CHOICES),
    transfers: z.array(z.object({ out_id: z.number().int(), in_id: z.number().int() }).strict()).max(SQUAD_SIZE),
    starters: z.array(z.number().int()).max(SQUAD_SIZE),
    bench: z.array(z.number().int()).max(SQUAD_SIZE),
    captain_id: z.number().int(),
    vice_captain_id: z.number().int(),
    reasons: z.array(z.object({ player_id: z.number().int(), reason: z.string() }).strict()).max(40)
  })
  .strict();

export type FullPlayerFacts = {
  /** FPL element_type: 1 GK, 2 DEF, 3 MID, 4 FWD. */
  type: number;
  club: string;
  /** Current price, tenths. */
  price: number;
};

/** What the server knows when it checks an answer. All of it is server data (the model only saw part of it). */
export type FullContext = {
  /** The 15 the manager holds now. */
  squadIds: readonly number[];
  /** Selling price (tenths) of each of the 15. */
  sell: ReadonlyMap<number, number>;
  /** Tenths of a million in the bank. */
  bank: number;
  freeTransfers: number;
  chips: { wildcard: boolean; freehit: boolean };
  /** Type, club and current price of the 15 and of every candidate in the pool: the only players the model may bring in. */
  players: ReadonlyMap<number, FullPlayerFacts>;
  /** Expected points of the target gameweek, for the figures shown beside the answer. */
  xp: ReadonlyMap<number, number>;
  knownPlayerIds: readonly number[];
  playerNames: ReadonlyMap<number, string>;
};

export type FullReasonRole = "starter" | "bench" | "out";

export type FullPlan = {
  summary: string;
  chip: ChipChoice;
  transfers: Array<{ out: number; in: number }>;
  lineup: ScenarioLineup;
  /** One line per player of the new 15 and per player sold, in that order (starters, bench, sold). */
  reasons: Array<{ playerId: number; role: FullReasonRole; incoming: boolean; reason: string }>;
  money: { transferCost: number; freeTransfers: number; bankAfter: number };
};

export type FullValidation = { ok: true; value: FullPlan } | { ok: false; code: string };

const dup = (values: number[]) => new Set(values).size !== values.length;
const bad = (code: string): FullValidation => ({ ok: false, code });

/** The seven FPL rules that matter here, checked in the order a person would: chip, transfers, squad, money, lineup, words. */
export function validateFullOutput(raw: unknown, ctx: FullContext): FullValidation {
  const parsed = shape.safeParse(raw);
  if (!parsed.success) return bad("schema");
  const data = parsed.data;

  // Chip and transfers
  if (data.chip === "wildcard" && !ctx.chips.wildcard) return bad("chip_unavailable");
  if (data.chip === "freehit" && !ctx.chips.freehit) return bad("chip_unavailable");
  if (data.chip === "none" && data.transfers.length > MAX_PLAIN_TRANSFERS) return bad("too_many_transfers");
  // A chip with no transfer would spend the chip for nothing.
  if (data.chip !== "none" && data.transfers.length === 0) return bad("chip_without_transfers");

  const squad = new Set(ctx.squadIds);
  const outs = data.transfers.map((transfer) => transfer.out_id);
  const ins = data.transfers.map((transfer) => transfer.in_id);
  if (dup(outs) || dup(ins)) return bad("duplicate_transfer_player");
  if (outs.some((id) => !squad.has(id))) return bad("out_not_in_squad");
  if (ins.some((id) => squad.has(id))) return bad("in_already_in_squad");
  if (ins.some((id) => !ctx.players.has(id))) return bad("unknown_in_player");

  // The new 15: 2 GK, 5 DEF, 5 MID, 3 FWD, at most three from one club.
  const outSet = new Set(outs);
  const final = [...ctx.squadIds.filter((id) => !outSet.has(id)), ...ins];
  const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  const perClub = new Map<string, number>();
  for (const id of final) {
    const facts = ctx.players.get(id);
    if (!facts) return bad("unknown_squad_player");
    counts[facts.type] = (counts[facts.type] ?? 0) + 1;
    perClub.set(facts.club, (perClub.get(facts.club) ?? 0) + 1);
  }
  if (final.length !== SQUAD_SIZE || [1, 2, 3, 4].some((type) => counts[type] !== POSITION_COUNTS[type])) return bad("squad_composition");
  if ([...perClub.values()].some((count) => count > MAX_PER_CLUB)) return bad("club_limit");

  // Money: what comes in must be paid for with what goes out (at selling prices) plus the bank.
  const sold = outs.reduce((sum, id) => sum + (ctx.sell.get(id) ?? ctx.players.get(id)?.price ?? 0), 0);
  const bought = ins.reduce((sum, id) => sum + (ctx.players.get(id)?.price ?? 0), 0);
  const bankAfter = ctx.bank + sold - bought;
  if (bankAfter < 0) return bad("over_budget");
  const cost = data.chip === "none" ? transferCost(data.transfers.length, ctx.freeTransfers) : 0;

  // Lineup: eleven and four, the same fifteen, a goalkeeper first on the bench, a legal formation.
  if (data.starters.length !== 11 || data.bench.length !== 4) return bad("lineup_size");
  const finalSet = new Set(final);
  const lineupIds = [...data.starters, ...data.bench];
  if (dup(lineupIds)) return bad("lineup_duplicate_player");
  if (lineupIds.some((id) => !finalSet.has(id))) return bad("lineup_player_not_in_squad");
  const typeOf = (id: number) => ctx.players.get(id)?.type ?? 0;
  if (data.starters.filter((id) => typeOf(id) === 1).length !== 1) return bad("formation");
  const [def, mid, fwd] = [2, 3, 4].map((type) => data.starters.filter((id) => typeOf(id) === type).length);
  if (!FORMATIONS.some(([d, m, f]) => d === def && m === mid && f === fwd)) return bad("formation");
  if (typeOf(data.bench[0]) !== 1) return bad("bench_goalkeeper");
  if (data.captain_id === data.vice_captain_id) return bad("captain_vice_same");
  if (!data.starters.includes(data.captain_id) || !data.starters.includes(data.vice_captain_id)) return bad("captain_not_starter");

  // One reason for each of the new 15 and each player sold, nobody else.
  const wanted = new Set<number>([...final, ...outs]);
  const reasonIds = data.reasons.map((item) => item.player_id);
  if (dup(reasonIds) || reasonIds.length !== wanted.size || reasonIds.some((id) => !wanted.has(id))) return bad("reasons_incomplete");

  const summary = checkSentence(data.summary, TEXT_LIMITS.summary, ctx);
  const sentences = new Map<number, string | Fail>(data.reasons.map((item) => [item.player_id, checkSentence(item.reason, TEXT_LIMITS.reason, ctx)]));
  const wrong = [summary, ...sentences.values()].find(failed);
  if (wrong) return bad(wrong.fail);
  const text = (id: number) => sentences.get(id) as string;

  // Starters in pitch order: goalkeeper, defenders, midfielders, forwards (the model's order inside a group).
  const starters = [1, 2, 3, 4].flatMap((type) => data.starters.filter((id) => typeOf(id) === type));
  const incomingSet = new Set(ins);
  const expectedPoints = starters.reduce((sum, id) => sum + (ctx.xp.get(id) ?? 0), 0);
  const lineup: ScenarioLineup = {
    formation: `${def}-${mid}-${fwd}`,
    starters,
    bench: [...data.bench],
    captainId: data.captain_id,
    viceCaptainId: data.vice_captain_id,
    expectedPoints,
    incoming: [...ins]
  };

  return {
    ok: true,
    value: {
      summary: summary as string,
      chip: data.chip,
      transfers: data.transfers.map((transfer) => ({ out: transfer.out_id, in: transfer.in_id })),
      lineup,
      reasons: [
        ...starters.map((id) => ({ playerId: id, role: "starter" as const, incoming: incomingSet.has(id), reason: text(id) })),
        ...data.bench.map((id) => ({ playerId: id, role: "bench" as const, incoming: incomingSet.has(id), reason: text(id) })),
        ...outs.map((id) => ({ playerId: id, role: "out" as const, incoming: false, reason: text(id) }))
      ],
      money: { transferCost: cost, freeTransfers: ctx.freeTransfers, bankAfter }
    }
  };
}

// ---------------------------------------------------------------------------------------------------------------
// What is stored and shown

/** The server's rules-engine best option, the yardstick the AI's own choice is compared with. */
export type FullRulesBest = {
  scenarioId: string;
  type: string;
  /** Starting-XI xP of the target gameweek, the transfer cost in points and the bank afterwards (tenths). */
  xp: number;
  transferCost: number;
  bankAfter: number;
};

export type FullAiResult = {
  mode: "full";
  /** False when the answer broke a rule twice: `lineup` is then the rules engine's best option and `failureCode` says which rule. */
  verified: boolean;
  failureCode: string | null;
  summary: string;
  chip: ChipChoice;
  transfers: Array<{ out: number; in: number }>;
  lineup: ScenarioLineup;
  reasons: FullPlan["reasons"];
  /** Server figures for the AI's choice (null when not verified). */
  money: FullPlan["money"] | null;
  rules: FullRulesBest;
  /** Cards of everyone the screen draws or names (the new 15 and the players sold). */
  cards: Record<string, LineupPlayerCard>;
  /** For the unverified fallback: the scenario whose lineup replaced the answer. */
  fallbackScenarioId: string | null;
  /** The rules engine's own transfers of that scenario, for the fallback screen. */
  fallbackMoves: { out: number[]; in: number[] } | null;
};
