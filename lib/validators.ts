import { z } from "zod";

/** FPL hands several numeric stats back as strings ("38.4"); normalise them at the edge. */
const numeric = z
  .union([z.string(), z.number()])
  .optional()
  .default(0)
  .transform((value) => {
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  });

export const bootstrapStaticSchema = z.object({
  // Every chip the season grants, split into first/second half windows.
  chips: z
    .array(
      z.object({
        name: z.string(),
        start_event: z.number(),
        stop_event: z.number()
      })
    )
    .optional()
    .default([]),
  events: z.array(
    z.object({
      id: z.number(),
      is_current: z.boolean(),
      is_next: z.boolean().optional().default(false),
      finished: z.boolean(),
      deadline_time: z.string().nullable().optional().default(null)
    })
  ),
  teams: z.array(
    z.object({
      id: z.number(),
      name: z.string(),
      short_name: z.string(),
      // Crest filenames key off code, not id.
      code: z.number().optional().default(0)
    })
  ),
  elements: z.array(
    z.object({
      id: z.number(),
      web_name: z.string(),
      team: z.number(),
      element_type: z.number(),
      photo: z.string(),
      // Everything below already arrives in the same response; the schema used to drop it.
      status: z.string().optional().default("a"),
      news: z.string().optional().default(""),
      minutes: z.number().optional().default(0),
      now_cost: z.number().optional().default(0),
      cost_change_event: z.number().optional().default(0),
      total_points: z.number().optional().default(0),
      event_points: z.number().optional().default(0),
      transfers_in_event: z.number().optional().default(0),
      transfers_out_event: z.number().optional().default(0),
      price_change_percent: numeric,
      price_change_projections: z
        .array(z.object({ offset: z.number(), projected_percent: numeric }))
        .optional()
        .default([]),
      price_change_locked_until: z.string().nullable().optional().default(null),
      form: numeric,
      points_per_game: numeric,
      selected_by_percent: numeric,
      ict_index: numeric,
      expected_goal_involvements: numeric
    })
  )
});

export const standingsPageSchema = z.object({
  league: z.object({
    id: z.number(),
    name: z.string()
  }),
  standings: z.object({
    has_next: z.boolean().optional().default(false),
    results: z.array(
      z.object({
        entry: z.number(),
        entry_name: z.string(),
        player_name: z.string(),
        rank: z.number(),
        total: z.number()
      })
    )
  })
});


export const entryHistorySchema = z.object({
  current: z.array(
    z.object({
      event: z.number(),
      points: z.number(),
      total_points: z.number(),
      overall_rank: z.number().nullable().optional().default(null),
      bank: z.number().optional().default(0),
      value: z.number().optional().default(0),
      event_transfers: z.number().optional().default(0),
      event_transfers_cost: z.number().optional().default(0),
      points_on_bench: z.number().optional().default(0)
    })
  ),
  chips: z
    .array(
      z.object({
        name: z.string(),
        event: z.number()
      })
    )
    .optional()
    .default([]),
  past: z
    .array(
      z.object({
        season_name: z.string(),
        total_points: z.number(),
        rank: z.number()
      })
    )
    .optional()
    .default([])
});

export const entrySchema = z.object({
  id: z.number(),
  summary_overall_points: z.number()
});

export const picksSchema = z.object({
  active_chip: z
    .union([
      z.literal("3xc"),
      z.literal("bboost"),
      z.literal("freehit"),
      z.literal("wildcard"),
      z.literal("manager")
    ])
    .nullable()
    .optional()
    .default(null),
  picks: z.array(
    z.object({
      element: z.number(),
      position: z.number(),
      multiplier: z.number(),
      is_captain: z.boolean(),
      is_vice_captain: z.boolean()
    })
  ),
  automatic_subs: z
    .array(
      z.object({
        element_in: z.number(),
        element_out: z.number(),
        entry: z.number(),
        event: z.number()
      })
    )
    .optional()
    .default([]),
  entry_history: z.object({
    event: z.number(),
    points: z.number(),
    total_points: z.number(),
    event_transfers_cost: z.number()
  })
});

export const liveSchema = z.object({
  elements: z.array(
    z.object({
      id: z.number(),
      stats: z.object({
        minutes: z.number(),
        total_points: z.number(),
        bonus: z.number().optional().default(0),
        bps: z.number().optional().default(0)
      }),
      // The per-fixture ledger behind total_points, which the score breakdown reads.
      explain: z
        .array(
          z.object({
            fixture: z.number(),
            stats: z.array(
              z.object({
                identifier: z.string(),
                points: z.number(),
                value: z.number(),
                points_modification: z.number().optional().default(0)
              })
            )
          })
        )
        .optional()
        .default([])
    })
  )
});

const fixtureStatValueSchema = z.object({
  value: z.number(),
  element: z.number()
});

export const fixturesSchema = z.array(
  z.object({
    id: z.number(),
    event: z.number().nullable(),
    kickoff_time: z.string().nullable().optional().default(null),
    team_h: z.number(),
    team_a: z.number(),
    team_h_score: z.number().nullable().optional().default(null),
    team_a_score: z.number().nullable().optional().default(null),
    started: z.boolean().nullable(),
    finished: z.boolean(),
    finished_provisional: z.boolean(),
    // Match clock as of the last FPL refresh; 0 before kickoff.
    minutes: z.number().optional().default(0),
    // Fixture difficulty ships with every fixture; the schema used to drop it.
    team_h_difficulty: z.number().optional().default(3),
    team_a_difficulty: z.number().optional().default(3),
    stats: z
      .array(
        z.object({
          identifier: z.string(),
          h: z.array(fixtureStatValueSchema),
          a: z.array(fixtureStatValueSchema)
        })
      )
      .optional()
      .default([])
  })
);

/** One player's gameweek-by-gameweek history. Fetched only when a player is opened. */
export const elementSummarySchema = z.object({
  history: z.array(
    z.object({
      round: z.number(),
      total_points: z.number(),
      minutes: z.number().optional().default(0),
      value: z.number().optional().default(0),
      selected: z.number().optional().default(0),
      transfers_balance: z.number().optional().default(0),
      bps: z.number().optional().default(0)
    })
  )
});