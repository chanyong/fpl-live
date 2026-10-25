# FPL Mini-League Live Dashboard

Next.js App Router MVP that uses official FPL public JSON endpoints to show a public classic mini-league's live standings, provisional gameweek points, and each squad's current status.

## MVP status

- MVP completed: public classic mini-league lookup, live league table, sortable/searchable rows, expandable squad view, server-side aggregation, runtime validation, auto refresh, tests, deployment docs.
- Known constraints: autosub and vice-captain fallback are implemented as a best-effort provisional model during live matches. Exact official post-deadline reconciliation can differ until FPL finalizes the event.
- Next improvements: richer fixture state badges, player detail drawer using `element-summary`, pagination virtualization for very large leagues, Playwright E2E, dark mode.

## Official data sources used

- `https://fantasy.premierleague.com/api/bootstrap-static/`
- `https://fantasy.premierleague.com/api/leagues-classic/{leagueId}/standings/`
- `https://fantasy.premierleague.com/api/entry/{entryId}/`
- `https://fantasy.premierleague.com/api/entry/{entryId}/event/{gw}/picks/`
- `https://fantasy.premierleague.com/api/event/{gw}/live/`
- `https://fantasy.premierleague.com/api/fixtures/`
- `https://fantasy.premierleague.com/api/stats/price-changes/`
- `https://fantasy.premierleague.com/api/element-summary/{playerId}/` — only when a
  player is opened in the player tab, never in bulk.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS v4
- TanStack Table
- TanStack React Query
- Zod
- Vitest

## Run locally

1. Install dependencies.

```bash
npm install
```

If PowerShell blocks `npm`, use:

```powershell
npm.cmd install
```

2. Create environment file.

```bash
cp .env.example .env.local
```

PowerShell:

```powershell
Copy-Item .env.example .env.local
```

3. Start the dev server.

```bash
npm run dev
```

PowerShell:

```powershell
npm.cmd run dev
```

4. Open `http://localhost:3000` and enter a public classic league ID.

## Scripts

- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run test`

## Architecture

- `app/league/[leagueId]/page.tsx`: dashboard route using URL param routing.
- `app/api/league-live/route.ts`: server aggregation endpoint for the client.
- `lib/fpl-client.ts`: official FPL fetch wrapper with cache policy.
- `lib/league-aggregator.ts`: joins standings, entry, picks, live, and fixtures into a single response.
- `lib/scoring.ts`: players played, provisional live points, captain handling, projected rank, and squad split logic.
- `components/*`: search form, refresh indicator, filters, table, expandable rows, and squad cards.

## Ranking model

- `projectedRank` uses standard competition ranking: managers on the same projected
  total share a rank and the following rank skips accordingly (1, 1, 1, 4, …).
- Official standing only breaks display order, never the rank number itself.
- The Rank Change tab reads the current gameweek from the same live payload as the
  league table, so the two tabs can never disagree on points or gameweek.

## Season figures

The rank-trend tab already fetches `entry/{id}/history/` per manager. Beyond the
weekly points it also carries chip usage, bench points, squad value, transfer
hits, overall rank and past seasons, all surfaced without any extra request:

- Chip availability is derived from `bootstrap-static` `chips`, which grants each
  chip once per half of the season, so "remaining" is exact rather than assumed.
- A played chip consumes the window its gameweek falls in; an unused chip whose
  window has closed is marked expired.

## Player figures

The player tab is served by `/api/player-stats`, which reuses the memoised league
payload and reads everything else out of `bootstrap-static` and `fixtures` — both
already fetched for the other tabs. No extra upstream request is made to render it.

- A player's gameweek score adds the same provisional bonus the league table uses,
  so the two tabs can never disagree about what a player has scored.
- **Provisional bonus is only ever estimated for a fixture FPL has not scored itself.**
  `finished` stays false until the whole gameweek is signed off, and the bonus rows can
  appear in a fixture before `finished_provisional` flips — at which point that bonus is
  already inside `event_points`. So the estimate is skipped the moment a fixture carries
  any bonus of its own; without that check a live Haaland read 12 instead of 9. Each half
  of a double gameweek is judged on its own, so a settled fixture never suppresses the
  estimate for one still in play.

### Score breakdown

`/api/player-points` returns one player's gameweek score line by line, read straight out
of the live endpoint's `explain` block rather than re-derived from the scoring rules — so
the breakdown always adds up to the number on the card. The provisional bonus is reported
as its own figure and labelled 잠정, so it is obvious which part is not final yet. It is
reachable from any squad card in the standings tab and from the player detail sheet.
- `transfers_in_event` / `transfers_out_event` reset at every deadline, so during a
  live gameweek they describe moves for the *next* one. The UI labels the window.
- **Effective ownership** counts only starters, and counts a captain twice — that is
  what actually scores.
- **Rank contribution** is `points × (1 − ownership)`: a player the whole league
  fields moves nobody, a player one manager fields is worth his full score. The
  gameweek figure uses effective ownership and is zero when every owner benched him;
  the season figure uses today's roster share, because past lineups are not kept.
- The global player table is trimmed to players with minutes, plus everyone a league
  squad holds, so a benched unused player still has a row.

## Price changes

`/api/price-changes` mirrors fantasy.premierleague.com/price-changes and backs both the
public `/price-changes` page and the player tab:

- Predictions cover every player FPL has not marked unavailable (`status !== "u"`), ordered
  by the size of the current progress. The status is FPL's own call from
  `price_change_projections[0].likelihood` (±5 very likely, ±4 likely, otherwise no change);
  locked and calibrating players are labelled as such.
- Recent changes come from FPL's dated log, `stats/price-changes/`, newest first.
- The countdown targets the first future entry of `game_config.settings.price_change_deadlines`.

## Assumptions for v1

- Only public classic mini-leagues are supported.
- Current GW is derived from `bootstrap-static` `events[].is_current`.
- `Total` is calculated from the mini-league official total minus official current GW points plus provisional live GW points, to avoid double-counting the current gameweek.
- Bench boost counts all 15 live points. Other chips are displayed, but wildcard/free hit internals rely on official picks data rather than custom modeling.
- Partial API failure returns partial rows instead of failing the whole dashboard.
- Player images use the official Premier League image CDN pattern and gracefully fall back to text-only cards if unavailable.

## Testing

Current test coverage focuses on the required core calculations:

- captain multiplier and vice-captain fallback
- players played
- GW live points with transfer hit
- projected rank
- starters/bench split

Run:

```bash
npm run test
```

## Deployment

### Vercel

1. Import the repository into Vercel.
2. Set `NEXT_PUBLIC_APP_URL` to the deployed URL.
3. Leave `FPL_BASE_URL` at the default unless routing through another proxy.
4. Deploy with the standard Next.js preset.

### Railway

1. Create a new service from the repository.
2. Add `NEXT_PUBLIC_APP_URL` for the public domain.
3. Build command: `npm install && npm run build`
4. Start command: `npm run start`

## Upstream request policy

Every FPL call goes through `lib/fpl-client.ts`, which applies:

- a per-request timeout (`FPL_TIMEOUT_MS`, default 10s)
- retries with exponential backoff on 429/408/5xx and network errors, honouring `Retry-After` (`FPL_MAX_ATTEMPTS`, default 3)
- bounded fan-out when fetching per-manager picks and history (`FPL_PICKS_CONCURRENCY`, default 8), so a large league cannot fire one request per manager at once

## Remaining limitations

- Official autosub behavior can change after all fixtures complete; live rows are marked provisional in the UI.
- No authentication flow for private leagues.
- No persistent server cache beyond the in-process memo.
- No Playwright suite yet.
- Interface copy is Korean; there is no locale switch.

