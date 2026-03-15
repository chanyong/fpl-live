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
- Optional future enhancement: `https://fantasy.premierleague.com/api/element-summary/{playerId}/`

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS v4
- TanStack Table
- TanStack React Query
- Zod
- date-fns
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

## Remaining limitations

- Official autosub behavior can change after all fixtures complete; live rows are marked provisional.
- No authentication flow for private leagues.
- No persistent server cache beyond Next.js fetch caching.
- No Playwright suite yet.

