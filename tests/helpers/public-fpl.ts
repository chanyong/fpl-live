import { bootstrapStaticSchema, fixturesSchema } from "@/lib/validators";

/**
 * Four-team FPL data for the public-page tests, built through the real schemas so a field the schema
 * drops cannot sneak into a fixture.
 */
export function bootstrapFixture(events: Array<{ id: number; is_current?: boolean; is_next?: boolean; finished?: boolean }>) {
  return bootstrapStaticSchema.parse({
    events: events.map((event) => ({ is_current: false, is_next: false, finished: false, ...event })),
    teams: [
      { id: 1, name: "Arsenal", short_name: "ARS", code: 3 },
      { id: 2, name: "Chelsea", short_name: "CHE", code: 8 },
      { id: 3, name: "Liverpool", short_name: "LIV", code: 14 },
      { id: 4, name: "Everton", short_name: "EVE", code: 11 }
    ],
    elements: [
      { id: 10, web_name: "Saka", team: 1, element_type: 3, photo: "1.jpg", minutes: 900, total_points: 80, event_points: 6, form: "7.5", selected_by_percent: "30.1", transfers_in_event: 90000, transfers_out_event: 10000, now_cost: 100 },
      { id: 11, web_name: "Palmer", team: 2, element_type: 3, photo: "2.jpg", minutes: 850, total_points: 95, event_points: 2, form: "5.0", selected_by_percent: "45.0", transfers_in_event: 1000, transfers_out_event: 50000, now_cost: 110 },
      { id: 12, web_name: "Bench Guy", team: 3, element_type: 2, photo: "3.jpg", minutes: 0, total_points: 0, event_points: 0, now_cost: 40 }
    ]
  });
}

type Fx = {
  id: number;
  event: number | null;
  kickoff_time: string | null;
  team_h: number;
  team_a: number;
  team_h_score?: number | null;
  team_a_score?: number | null;
  started?: boolean;
  finished?: boolean;
  finished_provisional?: boolean;
  minutes?: number;
};

export function fixturesFixture(list: Fx[]) {
  return fixturesSchema.parse(
    list.map((fixture) => ({
      team_h_score: null,
      team_a_score: null,
      started: false,
      finished: false,
      finished_provisional: false,
      ...fixture
    }))
  );
}
