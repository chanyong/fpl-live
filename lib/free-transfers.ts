/**
 * Free transfers an entry should have for the next gameweek, rebuilt from public history (issue #39 stage 2).
 * FPL only shows the real figure to the logged-in manager, so this is an ESTIMATE, and the screen says so.
 *
 * Rules, from the official rules page (fantasy.premierleague.com/the-rules, checked 2026-11-22):
 * - After the first deadline a manager gets 1 free transfer per gameweek.
 * - An unused free transfer rolls over; at most 5 can be stored (1 + game_config.rules.max_extra_free_transfers).
 * - Each transfer beyond the free ones costs 4 points.
 * - Playing a Wildcard or Free Hit: "any saved free transfers are retained for the following Gameweek" — the
 *   week's own free transfer is used up by the chip, so the count does not grow that week.
 * - A manager who joins mid-season builds an unlimited first squad; the free transfers start the week after.
 */
export const MAX_FREE_TRANSFERS = 5;
export const POINTS_PER_EXTRA_TRANSFER = 4;

export type TransferWeek = {
  event: number;
  /** Transfers made for this gameweek (history `event_transfers`). */
  transfers: number;
  /** Points deducted for them (history `event_transfers_cost`). */
  cost: number;
};

export type FreeTransferEstimate = {
  /** Free transfers available for the gameweek after the last one in the history; null before any history. */
  free: number | null;
  /** False when the rebuilt counts disagree with a recorded transfer cost, i.e. the estimate cannot be trusted. */
  matchesHistory: boolean;
  /** First gameweek where the rebuilt cost differed from the recorded one. */
  firstMismatchEvent: number | null;
};

const isTransferChip = (name: string) => name === "wildcard" || name === "freehit";

export function estimateFreeTransfers(args: {
  weeks: TransferWeek[];
  chips: Array<{ name: string; event: number }>;
  startedEvent: number;
  max?: number;
}): FreeTransferEstimate {
  const max = args.max ?? MAX_FREE_TRANSFERS;
  const weeks = [...args.weeks].sort((a, b) => a.event - b.event);
  const last = weeks.length > 0 ? weeks[weeks.length - 1].event : null;

  if (last === null) {
    return { free: null, matchesHistory: true, firstMismatchEvent: null };
  }

  const byEvent = new Map(weeks.map((week) => [week.event, week]));
  const transferChipEvents = new Set(args.chips.filter((chip) => isTransferChip(chip.name)).map((chip) => chip.event));
  const start = Math.max(1, args.startedEvent);

  // The first squad is free; the first stored free transfer is for the next week.
  let free = 1;
  let matchesHistory = true;
  let firstMismatchEvent: number | null = null;

  for (let event = start + 1; event <= last; event += 1) {
    const week = byEvent.get(event);
    const used = week?.transfers ?? 0;

    if (transferChipEvents.has(event)) {
      // Unlimited, no cost, and the stored count carries over unchanged.
      if (week && week.cost !== 0 && matchesHistory) {
        matchesHistory = false;
        firstMismatchEvent = event;
      }
      continue;
    }

    const expectedCost = Math.max(0, used - free) * POINTS_PER_EXTRA_TRANSFER;
    if (week && week.cost !== expectedCost && matchesHistory) {
      matchesHistory = false;
      firstMismatchEvent = event;
    }

    free = Math.min(max, Math.max(free - used, 0) + 1);
  }

  return { free, matchesHistory, firstMismatchEvent };
}

/** Points a manager will lose for `made` transfers when `free` are free. */
export function transferCost(made: number, free: number) {
  return Math.max(0, made - free) * POINTS_PER_EXTRA_TRANSFER;
}
