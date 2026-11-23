import { loadPlayerMeta } from "@/lib/ai/players";
import { EntryNotFoundError, EntryBusyError, FplUnavailableError, getEntrySquad, photoUrl } from "@/lib/entry-squad";
import { getBase } from "@/lib/public-data";
import type { EntrySquadPayload } from "@/lib/squad-types";
import { buildCaptainCandidates, type CaptainCandidate } from "@/lib/xp/captain";
import { buildLineups, type LineupCandidate } from "@/lib/xp/lineup";
import { XP_MODEL_VERSION, type XpPlayer, type XpTable } from "@/lib/xp/model";
import { getTransfers } from "@/lib/xp/transfer-service";
import type { TransferHorizon, TransferSearchResult } from "@/lib/xp/transfer-search";
import { getXpTable } from "@/lib/xp/xp-table";

export { EntryNotFoundError, EntryBusyError, FplUnavailableError };

export type RecommendPlayer = {
  elementId: number;
  webName: string;
  teamShortName: string;
  position: string;
  status: string;
  isStarter: boolean;
  /** xP of the target gameweek, the next 3 / 5 gameweeks (discounted), and the availability factor. */
  xpNext: number;
  xp3: number;
  xp5: number;
  availability: number;
  /** Fixtures of the target gameweek: none = blank, two = double. */
  nextFixtures: Array<{ opponent: string; home: boolean; difficulty: number }>;
};

export type RecommendAssumption = { code: string; text: string };

export type EntryRecommendBase = {
  entryId: number;
  modelVersion: typeof XP_MODEL_VERSION;
  /** Gameweek the xP and the candidates are for: the first whose deadline has not passed. */
  targetGw: number;
  /** Gameweek the squad was read from (the last deadline that passed); null when the team has no history. */
  squadGw: number | null;
  /** When the squad was loaded and when the xP table was built (ms since epoch). */
  squadFetchedAt: number;
  xpBuiltAt: number;
  /** The 15 in FPL pick order. */
  players: RecommendPlayer[];
  /** L1 (recommended) to L3, best first. */
  lineups: LineupCandidate[];
  /** Top five of L1 by xP, with a recommendation weight (not a probability). */
  captains: CaptainCandidate[];
  assumptions: RecommendAssumption[];
};

/** What the screen needs to name a player a transfer scenario moves (the buyer is usually not in the squad). */
export type ScenarioPlayerInfo = { webName: string; teamShortName: string; position: string; nowCost: number };

/**
 * The route's answer: the base plus the transfer scenarios (null when the team has no full squad yet) and the
 * display info of every player those scenarios move, keyed by player ID.
 */
export type EntryRecommendPayload = EntryRecommendBase & {
  transfers: TransferSearchResult | null;
  playerInfo: Record<string, ScenarioPlayerInfo>;
  /** Issue #61: per scenario ID, the XI, bench and captains after the move (absent in older logged payloads). */
  scenarioLineups?: Record<string, ScenarioLineup>;
  /** Issue #61: what a pitch card needs for every player any scenario lineup uses, keyed by player ID. */
  lineupPlayers?: Record<string, LineupPlayerCard>;
};

/** The recommended XI, bench order and captains of the squad as it is after one transfer scenario. */
export type ScenarioLineup = {
  formation: string;
  /** Eleven IDs, goalkeeper first, then DEF, MID, FWD. */
  starters: number[];
  /** Bench in FPL order: the spare goalkeeper, then three outfield players. */
  bench: number[];
  captainId: number | null;
  viceCaptainId: number | null;
  /** Sum of the starters' xP for the target gameweek. */
  expectedPoints: number;
  /** Players the scenario brings in (they get the "new" mark). */
  incoming: number[];
};

export type LineupPlayerCard = {
  webName: string;
  teamShortName: string;
  position: string;
  status: string;
  news: string;
  photoUrl: string | null;
  xpNext: number;
  fixtures: Array<{ opponent: string; home: boolean; difficulty: number }>;
};

export const ASSUMPTIONS: RecommendAssumption[] = [
  {
    code: "squad_last_deadline",
    text: "The squad is the one at the last passed deadline; transfers, lineup and captain changes made since are not seen."
  },
  {
    code: "xp1_rules",
    text: "Expected points use form, points per game, start ratio, fixture difficulty and home/away only; they are estimates, not forecasts."
  },
  {
    code: "chance_next_gw_only",
    text: "FPL's chance of playing applies to the next gameweek only; later weeks use the start ratio."
  },
  {
    code: "transfer_prices_estimated",
    text: "Selling prices and free transfers are estimates (FPL shows the real figures only to the logged-in manager); transfers made since the last deadline are not seen."
  },
  {
    code: "transfer_pool_search",
    text: "Transfer scenarios search a pool of about 30 candidates per position, not every player. Wildcard and Free Hit are a greedy search and not guaranteed best."
  },
  {
    code: "weight_not_probability",
    text: "The captain weight is a relative recommendation among five players, not the probability of the top score."
  }
];

function toRecommendPlayer(player: EntrySquadPayload["squad"][number], xp: XpPlayer | undefined): RecommendPlayer {
  return {
    elementId: player.elementId,
    webName: player.webName,
    teamShortName: player.teamShortName,
    position: player.position,
    status: player.status,
    isStarter: player.isStarter,
    xpNext: xp?.next ?? 0,
    xp3: xp?.sum3 ?? 0,
    xp5: xp?.sum5 ?? 0,
    availability: xp?.availability ?? 0,
    nextFixtures: (xp?.weeks[0]?.games ?? []).map((game) => ({
      opponent: game.opponent,
      home: game.home,
      difficulty: game.difficulty
    }))
  };
}

/** Pure assembly of the recommendation from one team's squad and the shared xP table. */
export function buildEntryRecommend(squad: EntrySquadPayload, table: XpTable): EntryRecommendBase {
  const squadPlayers = squad.squad;
  const players = squadPlayers.map((player) => toRecommendPlayer(player, table.players.get(player.elementId)));

  const lineups = buildLineups(
    squadPlayers.map((player) => ({
      id: player.elementId,
      elementType: { GKP: 1, DEF: 2, MID: 3, FWD: 4 }[player.position],
      xp: table.players.get(player.elementId)?.next ?? 0,
      isStarter: player.isStarter
    }))
  );

  const byId = new Map(players.map((player) => [player.elementId, player]));
  const best = lineups[0];
  const captains = best
    ? buildCaptainCandidates(
        best.starters.map((id) => {
          const player = byId.get(id)!;
          return {
            id,
            xp: player.xpNext,
            fixtures: player.nextFixtures.map((fixture) => ({ opponent: fixture.opponent, home: fixture.home })),
            selectedByPercent: table.players.get(id)?.selectedByPercent ?? 0
          };
        })
      )
    : [];

  return {
    entryId: squad.entryId,
    modelVersion: table.modelVersion,
    targetGw: table.targetGw,
    squadGw: squad.gw,
    squadFetchedAt: squad.fetchedAt,
    xpBuiltAt: table.builtAt,
    players,
    lineups,
    captains,
    assumptions: ASSUMPTIONS
  };
}

/**
 * Issue #61: for every scenario, the best XI / bench / captain of the squad after its transfers, by the same
 * lineup and captain rules as the "roll" recommendation (so roll equals the lineups[0] and captains above).
 * The card info of everyone involved comes from the squad, else the shared bootstrap (names and photos only).
 */
export async function buildScenarioLineups(
  squad: EntrySquadPayload,
  transfers: TransferSearchResult | null,
  table: XpTable
): Promise<{ scenarioLineups: Record<string, ScenarioLineup>; lineupPlayers: Record<string, LineupPlayerCard> }> {
  if (!transfers) {
    return { scenarioLineups: {}, lineupPlayers: {} };
  }
  const base = await getBase().catch(() => null);
  const elements = new Map((base?.bootstrap.elements ?? []).map((element) => [element.id, element]));
  const teams = new Map((base?.bootstrap.teams ?? []).map((team) => [team.id, team.short_name]));
  const own = new Map(squad.squad.map((player) => [player.elementId, player]));

  const cards: Record<string, LineupPlayerCard> = {};
  const cardOf = (id: number) => {
    const row = table.players.get(id);
    const mine = own.get(id);
    const element = elements.get(id);
    cards[String(id)] = {
      webName: mine?.webName ?? element?.web_name ?? `#${id}`,
      teamShortName: mine?.teamShortName ?? teams.get(row?.teamId ?? 0) ?? "-",
      position: mine?.position ?? POSITION_BY_TYPE[row?.elementType ?? 3] ?? "MID",
      status: mine?.status ?? row?.status ?? "a",
      news: mine?.news ?? element?.news ?? "",
      photoUrl: mine ? mine.photoUrl : element?.photo ? photoUrl(element.photo) : null,
      xpNext: row?.next ?? 0,
      fixtures: (row?.weeks[0]?.games ?? []).map((game) => ({ opponent: game.opponent, home: game.home, difficulty: game.difficulty }))
    };
  };

  const scenarioLineups: Record<string, ScenarioLineup> = {};
  for (const scenario of transfers.scenarios) {
    const gone = new Set(scenario.out);
    const ids = [...squad.squad.map((player) => player.elementId).filter((id) => !gone.has(id)), ...scenario.in];
    const best = buildLineups(
      ids.map((id) => ({ id, elementType: table.players.get(id)?.elementType ?? 3, xp: table.players.get(id)?.next ?? 0, isStarter: false })),
      1
    )[0];
    if (!best) continue;
    const captains = buildCaptainCandidates(
      best.starters.map((id) => ({
        id,
        xp: table.players.get(id)?.next ?? 0,
        fixtures: (table.players.get(id)?.weeks[0]?.games ?? []).map((game) => ({ opponent: game.opponent, home: game.home })),
        selectedByPercent: table.players.get(id)?.selectedByPercent ?? 0
      }))
    );
    scenarioLineups[scenario.id] = {
      formation: best.formation,
      starters: best.starters,
      bench: best.bench,
      captainId: captains[0]?.id ?? null,
      viceCaptainId: captains[1]?.id ?? null,
      expectedPoints: best.expectedPoints,
      incoming: [...scenario.in]
    };
    for (const id of [...best.starters, ...best.bench]) {
      if (!cards[String(id)]) cardOf(id);
    }
  }
  return { scenarioLineups, lineupPlayers: cards };
}

const POSITION_BY_TYPE: Record<number, string> = { 1: "GKP", 2: "DEF", 3: "MID", 4: "FWD" };

/** Name, club, position and current price of everyone a scenario moves, from the shared bootstrap (no FPL call). */
export async function buildScenarioPlayerInfo(
  transfers: TransferSearchResult | null,
  table: XpTable
): Promise<Record<string, ScenarioPlayerInfo>> {
  if (!transfers) {
    return {};
  }
  const ids = new Set<number>();
  for (const scenario of transfers.scenarios) {
    for (const id of [...scenario.out, ...scenario.in]) ids.add(id);
  }
  let meta: Awaited<ReturnType<typeof loadPlayerMeta>>;
  try {
    meta = await loadPlayerMeta();
  } catch {
    // The names are decoration: without the bootstrap the screen falls back to the player ID.
    return {};
  }
  const info: Record<string, ScenarioPlayerInfo> = {};
  for (const id of [...ids].sort((a, b) => a - b)) {
    const name = meta.get(id);
    const row = table.players.get(id);
    if (name) {
      info[String(id)] = {
        webName: name.name,
        teamShortName: name.teamShort,
        position: name.position,
        nowCost: row?.nowCost ?? 0
      };
    }
  }
  return info;
}

/**
 * One team's recommendation: getEntrySquad (memoised 5 minutes, FPL calls capped for the whole process) plus
 * the shared xP table (memoised 10 minutes). No FPL call of its own.
 */
export async function getEntryRecommend(
  entryId: number,
  forceRefresh = false,
  horizon: TransferHorizon = 3
): Promise<EntryRecommendPayload> {
  const [squad, table] = await Promise.all([getEntrySquad(entryId, forceRefresh), getXpTable()]);
  if (!table) {
    // FPL did not answer and nothing is cached, or the season is over (no deadline ahead).
    throw new FplUnavailableError();
  }
  const base = buildEntryRecommend(squad, table);
  const transfers = await getTransfers(squad, table, horizon);
  const [playerInfo, lineups] = await Promise.all([buildScenarioPlayerInfo(transfers, table), buildScenarioLineups(squad, transfers, table)]);
  return { ...base, transfers, playerInfo, ...lineups };
}
