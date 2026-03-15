import { z } from "zod";

export const bootstrapStaticSchema = z.object({
  events: z.array(
    z.object({
      id: z.number(),
      is_current: z.boolean(),
      finished: z.boolean()
    })
  ),
  teams: z.array(
    z.object({
      id: z.number(),
      short_name: z.string()
    })
  ),
  elements: z.array(
    z.object({
      id: z.number(),
      web_name: z.string(),
      team: z.number(),
      element_type: z.number(),
      photo: z.string()
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
        total_points: z.number()
      })
    })
  )
});

export const fixturesSchema = z.array(
  z.object({
    id: z.number(),
    event: z.number().nullable(),
    team_h: z.number(),
    team_a: z.number(),
    started: z.boolean().nullable(),
    finished: z.boolean(),
    finished_provisional: z.boolean()
  })
);
