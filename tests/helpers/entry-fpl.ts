import {
  bootstrapStaticSchema,
  entryHistorySchema,
  entrySchema,
  fixturesSchema,
  picksSchema,
  transfersSchema
} from "@/lib/validators";

/**
 * A small FPL world for the squad-screen tests (issue #39 stage 2), built through the real schemas so a field
 * the schema drops cannot sneak into a fixture. Gameweek 11 is current (its deadline has passed), 12 is next.
 */
export function squadBootstrap() {
  return bootstrapStaticSchema.parse({
    chips: [
      { name: "wildcard", start_event: 2, stop_event: 19 },
      { name: "wildcard", start_event: 20, stop_event: 38 },
      { name: "freehit", start_event: 2, stop_event: 19 },
      { name: "freehit", start_event: 20, stop_event: 38 },
      { name: "bboost", start_event: 1, stop_event: 19 },
      { name: "bboost", start_event: 20, stop_event: 38 },
      { name: "3xc", start_event: 1, stop_event: 19 },
      { name: "3xc", start_event: 20, stop_event: 38 }
    ],
    events: [
      { id: 10, is_current: false, is_next: false, finished: true, deadline_time: "2026-11-07T11:00:00Z" },
      { id: 11, is_current: true, is_next: false, finished: false, deadline_time: "2026-11-21T11:00:00Z" },
      { id: 12, is_current: false, is_next: true, finished: false, deadline_time: "2026-11-27T18:30:00Z" }
    ],
    teams: [
      { id: 1, name: "Arsenal", short_name: "ARS", code: 3 },
      { id: 2, name: "Chelsea", short_name: "CHE", code: 8 },
      { id: 3, name: "Liverpool", short_name: "LIV", code: 14 }
    ],
    elements: [
      // Held since the first squad: opening price 95, now 100 (+5).
      { id: 10, web_name: "Saka", team: 1, element_type: 3, photo: "1.jpg", now_cost: 100, cost_change_start: 5, cost_change_event: 1, event_points: 6, form: "7.5", selected_by_percent: "30.1", total_points: 80 },
      // Bought at 100, now 110.
      { id: 11, web_name: "Palmer", team: 2, element_type: 3, photo: "2.jpg", now_cost: 110, cost_change_start: 10, cost_change_event: 0, event_points: 2, form: "5.0", selected_by_percent: "45.0", total_points: 95 },
      // Bought at 50, now 40: a fall is paid out in full.
      { id: 12, web_name: "Bench Guy", team: 3, element_type: 2, photo: "3.jpg", now_cost: 40, cost_change_start: -10, cost_change_event: -1, event_points: 0, form: "0.0", selected_by_percent: "1.0", status: "d", news: "Knock" },
      { id: 13, web_name: "Keeper", team: 3, element_type: 1, photo: "4.jpg", now_cost: 45, cost_change_start: 0, event_points: 3, form: "3.0", selected_by_percent: "5.0" }
    ]
  });
}

export function squadFixtures() {
  return fixturesSchema.parse([
    // Next gameweek (12): Arsenal home to Chelsea and away to Liverpool, a double for Arsenal.
    { id: 1, event: 12, team_h: 1, team_a: 2, started: false, finished: false, finished_provisional: false, team_h_difficulty: 2, team_a_difficulty: 4 },
    { id: 2, event: 12, team_h: 3, team_a: 1, started: false, finished: false, finished_provisional: false, team_h_difficulty: 3, team_a_difficulty: 5 },
    // Already played.
    { id: 3, event: 11, team_h: 2, team_a: 3, started: true, finished: true, finished_provisional: true, team_h_difficulty: 3, team_a_difficulty: 3 }
  ]);
}

export function squadEntry(extra: Record<string, unknown> = {}) {
  return entrySchema.parse({
    id: 777,
    summary_overall_points: 700,
    name: "Test FC",
    player_first_name: "Kim",
    player_last_name: "Lee",
    started_event: 1,
    ...extra
  });
}

type Week = { event: number; bank?: number; value?: number; transfers?: number; cost?: number };

export function squadHistory(weeks: Week[], chips: Array<{ name: string; event: number }> = []) {
  return entryHistorySchema.parse({
    current: weeks.map((week) => ({
      event: week.event,
      points: 50,
      total_points: 50 * week.event,
      bank: week.bank ?? 5,
      value: week.value ?? 1000,
      event_transfers: week.transfers ?? 0,
      event_transfers_cost: week.cost ?? 0
    })),
    chips: chips.map((chip) => ({ ...chip, time: "2026-09-01T00:00:00Z" }))
  });
}

export function squadTransfers(extra: Array<Record<string, unknown>> = []) {
  return transfersSchema.parse([
    ...extra,
    { element_in: 11, element_in_cost: 100, element_out: 99, element_out_cost: 90, entry: 777, event: 10, time: "2026-11-04T11:52:48Z" },
    { element_in: 12, element_in_cost: 50, element_out: 98, element_out_cost: 50, entry: 777, event: 9, time: "2026-10-29T14:20:07Z" }
  ]);
}

export function squadPicks(gw: number, activeChip: string | null = null) {
  return picksSchema.parse({
    active_chip: activeChip,
    picks: [
      { element: 13, position: 1, multiplier: 1, is_captain: false, is_vice_captain: false },
      { element: 10, position: 2, multiplier: 2, is_captain: true, is_vice_captain: false },
      { element: 11, position: 3, multiplier: 1, is_captain: false, is_vice_captain: true },
      { element: 12, position: 12, multiplier: 0, is_captain: false, is_vice_captain: false }
    ],
    entry_history: { event: gw, points: 50, total_points: 550, event_transfers_cost: 0, event_transfers: 0, bank: 5, value: 1000 }
  });
}
