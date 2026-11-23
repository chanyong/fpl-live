import { chipStatuses } from "@/lib/chip-availability";
import { mapWithConcurrency } from "@/lib/concurrency";
import { estimateFreeTransfers } from "@/lib/free-transfers";
import {
  FplRequestError,
  getElementSummary,
  getEntry,
  getEntryHistory,
  getEntryPicks,
  getEntryTransfers,
  getEventLive,
  type getBootstrapStatic,
  type getFixtures
} from "@/lib/fpl-client";
import { POSITION_BY_TYPE } from "@/lib/player-metrics";
import { getBase } from "@/lib/public-data";
import { publicCurrentGw } from "@/lib/public-football";
import { purchasePrices, sellingPrice } from "@/lib/selling-price";
import type { EntrySquadPayload, SquadFixture, SquadOutlookWeek, SquadPlayer } from "@/lib/squad-types";

type Bootstrap = Awaited<ReturnType<typeof getBootstrapStatic>>;
type Fixtures = Awaited<ReturnType<typeof getFixtures>>;
type Entry = Awaited<ReturnType<typeof getEntry>>;
type History = Awaited<ReturnType<typeof getEntryHistory>>;
type Transfers = Awaited<ReturnType<typeof getEntryTransfers>>;
type Picks = Awaited<ReturnType<typeof getEntryPicks>>;

export type EntrySquadInputs = {
  entryId: number;
  bootstrap: Bootstrap;
  fixtures: Fixtures;
  entry: Entry;
  history: History;
  transfers: Transfers;
  /** Picks of `squadGw`; null when the team has no history yet. */
  picks: Picks | null;
  squadGw: number | null;
  /** Player points of `squadGw` when bootstrap's `event_points` is for another week; null otherwise. */
  eventPointsOverride: Map<number, number> | null;
  /** Prices when a late-joining manager first built the squad, for players with no transfer record. */
  startPrices: Map<number, number>;
  now: number;
};

export function photoUrl(photo: string) {
  return photo
    ? `https://resources.premierleague.com/premierleague/photos/players/110x140/p${photo.replace(".jpg", "")}.png`
    : null;
}

/** The next gameweek still ahead: FPL's `is_next`, else the first one after the current. */
function nextEvent(events: Bootstrap["events"], currentGw: number) {
  return events.find((event) => event.is_next) ?? events.find((event) => event.id > currentGw) ?? null;
}

/** Pure assembly of the squad screen's data from what FPL returned; see loadEntrySquad for the calls. */
export function buildEntrySquad(input: EntrySquadInputs): EntrySquadPayload {
  const { bootstrap, fixtures, entry, history, transfers, picks, squadGw } = input;
  const currentGw = publicCurrentGw(bootstrap.events);
  const next = nextEvent(bootstrap.events, currentGw);
  const nextGw = next?.id ?? null;
  const elementsById = new Map(bootstrap.elements.map((element) => [element.id, element]));
  const teamsById = new Map(bootstrap.teams.map((team) => [team.id, team]));

  const weeks = history.current.map((week) => ({
    event: week.event,
    transfers: week.event_transfers,
    cost: week.event_transfers_cost
  }));
  const lastEvent = weeks.length > 0 ? Math.max(...weeks.map((week) => week.event)) : null;
  const lastWeek = history.current.find((week) => week.event === lastEvent);
  const squadWeek = history.current.find((week) => week.event === squadGw) ?? lastWeek;

  const freeHitEvents = new Set(history.chips.filter((chip) => chip.name === "freehit").map((chip) => chip.event));
  const bought = purchasePrices(transfers, freeHitEvents);

  // Issue #74: the next 5 gameweeks per team, so a card can show 3 or 5 fixtures. The first week is `fixtures`.
  const outlookGws = nextGw === null ? [] : Array.from({ length: 5 }, (_, index) => nextGw + index).filter((gw) => gw <= 38);
  const outlookByTeam = new Map<number, Map<number, SquadFixture[]>>();
  for (const fixture of fixtures.filter((item) => outlookGws.includes(item.event as number))) {
    const gw = fixture.event as number;
    for (const home of [true, false]) {
      const teamId = home ? fixture.team_h : fixture.team_a;
      const opponentId = home ? fixture.team_a : fixture.team_h;
      const weeks = outlookByTeam.get(teamId) ?? new Map<number, SquadFixture[]>();
      const list = weeks.get(gw) ?? [];
      list.push({
        opponent: teamsById.get(opponentId)?.short_name ?? "-",
        home,
        difficulty: home ? fixture.team_h_difficulty : fixture.team_a_difficulty
      });
      weeks.set(gw, list);
      outlookByTeam.set(teamId, weeks);
    }
  }
  const outlookOf = (teamId: number): SquadOutlookWeek[] =>
    outlookGws.map((gw) => ({ gw, games: outlookByTeam.get(teamId)?.get(gw) ?? [] }));

  const squad: SquadPlayer[] = (picks?.picks ?? [])
    .map((pick): SquadPlayer => {
      const element = elementsById.get(pick.element);
      const nowCost = element?.now_cost ?? 0;
      const costChangeStart = element?.cost_change_start ?? 0;
      // Held since the first squad: the opening price if the manager joined in gameweek 1, else the price
      // when he built it.
      const heldSinceStart =
        entry.started_event <= 1 ? nowCost - costChangeStart : (input.startPrices.get(pick.element) ?? null);
      const purchaseCost = element ? (bought.get(pick.element) ?? heldSinceStart) : null;

      return {
        elementId: pick.element,
        webName: element?.web_name ?? `#${pick.element}`,
        teamShortName: teamsById.get(element?.team ?? 0)?.short_name ?? "-",
        teamCode: teamsById.get(element?.team ?? 0)?.code ?? 0,
        position: POSITION_BY_TYPE[element?.element_type ?? 3] ?? "MID",
        pickPosition: pick.position,
        isStarter: pick.position <= 11,
        isCaptain: pick.is_captain,
        isViceCaptain: pick.is_vice_captain,
        photoUrl: element ? photoUrl(element.photo) : null,
        status: element?.status ?? "a",
        news: element?.news ?? "",
        nowCost,
        purchaseCost,
        sellingPrice: purchaseCost === null ? null : sellingPrice(purchaseCost, nowCost),
        costChangeEvent: element?.cost_change_event ?? 0,
        costChangeStart,
        form: element?.form ?? 0,
        selectedByPercent: element?.selected_by_percent ?? 0,
        eventPoints: input.eventPointsOverride
          ? (input.eventPointsOverride.get(pick.element) ?? 0)
          : squadGw === currentGw
            ? (element?.event_points ?? null)
            : null,
        fixtures: outlookOf(element?.team ?? 0)[0]?.games ?? [],
        outlook: outlookOf(element?.team ?? 0)
      };
    })
    .sort((a, b) => a.pickPosition - b.pickPosition);

  const estimate = estimateFreeTransfers({ weeks, chips: history.chips, startedEvent: entry.started_event });
  const sellingKnown = squad.length > 0 && squad.every((player) => player.sellingPrice !== null);

  return {
    entryId: input.entryId,
    teamName: entry.name,
    managerName: `${entry.player_first_name} ${entry.player_last_name}`.trim(),
    gw: squadGw,
    freeHitFallback: squadGw !== null && lastEvent !== null && squadGw !== lastEvent,
    nextGw,
    nextDeadline: next?.deadline_time ?? null,
    activeChip: picks?.active_chip ?? null,
    squad,
    bank: squadWeek?.bank ?? 0,
    squadValue: squad.reduce((sum, player) => sum + player.nowCost, 0),
    squadSellingValue: sellingKnown ? squad.reduce((sum, player) => sum + (player.sellingPrice ?? 0), 0) : null,
    chips: chipStatuses(bootstrap.chips, history.chips, nextGw ?? (lastEvent ?? 0) + 1),
    transfers: {
      freeTransfers: estimate.free,
      freeTransfersMatchHistory: estimate.matchesHistory,
      lastGwTransfers: lastWeek?.event_transfers ?? 0,
      lastGwCost: lastWeek?.event_transfers_cost ?? 0,
      pendingTransfers: lastEvent === null ? 0 : transfers.filter((transfer) => transfer.event > lastEvent).length
    },
    fetchedAt: input.now
  };
}

/** A team ID FPL does not know (the route answers 404). */
export class EntryNotFoundError extends Error {
  constructor() {
    super("Team not found");
    this.name = "EntryNotFoundError";
  }
}

/** FPL's shared data (bootstrap, fixtures) is unavailable and nothing is cached (the route answers 502). */
export class FplUnavailableError extends Error {
  constructor() {
    super("FPL data is unavailable");
    this.name = "FplUnavailableError";
  }
}

/** Too many teams are being loaded from FPL at once, whoever asks (the route answers 503 + Retry-After). */
export class EntryBusyError extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super("Too many team loads in progress");
    this.name = "EntryBusyError";
  }
}

/** An FPL answer other than "no such team" (maintenance, rate limit) is an outage, not our bug. */
function asOutage(error: unknown) {
  return error instanceof FplRequestError ? new FplUnavailableError() : error;
}

/** Price of each player in the gameweek a late-joining manager built the first squad (element-summary). */
async function loadStartPrices(startedEvent: number, ids: number[]) {
  const prices = new Map<number, number>();
  const settled = await mapWithConcurrency(ids, 5, async (id) => {
    const summary = await getElementSummary(id);
    const week = summary.history.find((item) => item.round >= startedEvent && item.value > 0);
    return week ? ([id, week.value] as const) : null;
  });

  for (const result of settled) {
    if (result.status === "fulfilled" && result.value) {
      prices.set(result.value[0], result.value[1]);
    }
  }

  return prices;
}

async function loadEntrySquad(entryId: number): Promise<EntrySquadPayload> {
  const base = await getBase();
  if (!base) {
    throw new FplUnavailableError();
  }

  let entry: Entry;
  let history: History;
  let transfers: Transfers;
  try {
    [entry, history, transfers] = await Promise.all([
      getEntry(entryId),
      getEntryHistory(entryId),
      getEntryTransfers(entryId)
    ]);
  } catch (error) {
    if (error instanceof FplRequestError && error.status === 404) {
      throw new EntryNotFoundError();
    }
    throw asOutage(error);
  }

  const lastEvent = history.current.reduce<number | null>(
    (max, week) => (max === null || week.event > max ? week.event : max),
    null
  );
  const currentGw = publicCurrentGw(base.bootstrap.events);
  const freeHitEvents = new Set(history.chips.filter((chip) => chip.name === "freehit").map((chip) => chip.event));
  // A Free Hit week's squad is undone at the next deadline, so show the one the manager goes back to.
  const squadGw =
    lastEvent === null
      ? null
      : freeHitEvents.has(lastEvent) && history.current.some((week) => week.event === lastEvent - 1)
        ? lastEvent - 1
        : lastEvent;

  const picks =
    squadGw === null
      ? null
      : await getEntryPicks(entryId, squadGw).catch((error: unknown) => {
          throw asOutage(error);
        });

  let eventPointsOverride: Map<number, number> | null = null;
  if (squadGw !== null && squadGw !== currentGw) {
    try {
      const live = await getEventLive(squadGw);
      eventPointsOverride = new Map(live.elements.map((element) => [element.id, element.stats.total_points]));
    } catch (error) {
      console.error("[entry-squad] live points", error);
    }
  }

  let startPrices = new Map<number, number>();
  if (picks && entry.started_event > 1) {
    const bought = purchasePrices(transfers, freeHitEvents);
    const unknown = picks.picks.map((pick) => pick.element).filter((id) => !bought.has(id));
    startPrices = await loadStartPrices(entry.started_event, unknown);
  }

  return buildEntrySquad({
    entryId,
    bootstrap: base.bootstrap,
    fixtures: base.fixtures,
    entry,
    history,
    transfers,
    picks,
    squadGw,
    eventPointsOverride,
    startPrices,
    now: Date.now()
  });
}

/**
 * One team's squad screen data. Memoised per team for 5 minutes (at most 200 teams, oldest dropped), and
 * concurrent requests for the same team share one set of FPL calls. `forceRefresh` skips the memo.
 *
 * Loads from FPL are capped for the whole process, whatever IP asks: the per-IP limits in
 * lib/entry-request-limit rest on a forwarded header, and one load is up to 20 FPL calls (60 with retries).
 * FPL blocking this server would take the league screens down with it.
 */
const TTL_MS = 5 * 60_000;
const MAX_ENTRIES = 200;
const MAX_CONCURRENT_LOADS = 5;
const MAX_LOADS_PER_MINUTE = 60;
const LOAD_WINDOW_MS = 60_000;
let loadTimes: number[] = [];
const cache = new Map<number, { data: EntrySquadPayload; expiresAt: number }>();
const inflight = new Map<number, Promise<EntrySquadPayload>>();

export function resetEntrySquadCache() {
  cache.clear();
  inflight.clear();
  loadTimes = [];
}

export async function getEntrySquad(entryId: number, forceRefresh = false): Promise<EntrySquadPayload> {
  if (!forceRefresh) {
    const hit = cache.get(entryId);
    if (hit && hit.expiresAt > Date.now()) {
      return hit.data;
    }
  }

  const running = inflight.get(entryId);
  if (running) {
    return running;
  }

  const now = Date.now();
  // Expired teams leave memory here rather than waiting to be pushed out by the 200-team cap.
  for (const [id, item] of cache) if (item.expiresAt <= now) cache.delete(id);

  loadTimes = loadTimes.filter((at) => now - at < LOAD_WINDOW_MS);
  if (inflight.size >= MAX_CONCURRENT_LOADS) {
    throw new EntryBusyError(5);
  }
  if (loadTimes.length >= MAX_LOADS_PER_MINUTE) {
    throw new EntryBusyError(Math.max(1, Math.ceil((loadTimes[0] + LOAD_WINDOW_MS - now) / 1000)));
  }
  loadTimes.push(now);

  const promise = loadEntrySquad(entryId)
    .then((data) => {
      cache.delete(entryId);
      cache.set(entryId, { data, expiresAt: Date.now() + TTL_MS });
      while (cache.size > MAX_ENTRIES) {
        const oldest = cache.keys().next().value;
        if (oldest === undefined) break;
        cache.delete(oldest);
      }
      return data;
    })
    .finally(() => {
      inflight.delete(entryId);
    });
  inflight.set(entryId, promise);
  return promise;
}
