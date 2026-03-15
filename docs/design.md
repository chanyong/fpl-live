# Design Notes

## Data flow

1. Client opens `/league/[leagueId]`.
2. React Query calls `/api/league-live?leagueId=...&gw=current` every 30 seconds.
3. Server route fetches official FPL JSON endpoints and validates payloads with Zod.
4. Aggregator merges standings, entry totals, picks, live stats, and fixtures into one response.
5. Client renders a sortable table and expandable squad strips.

## Cache strategy

- Next.js server fetches use `revalidate: 30` by default.
- Manual refresh sets `refresh=1`, which switches the server fetches to `no-store`.
- Route response advertises `s-maxage=30, stale-while-revalidate=30`.

## Provisional scoring policy

- `playersPlayed`: starter counted when the fixture has started or the player has minutes.
- `gwPoints`: sum of current live points with captain/triple captain multiplier minus transfer cost.
- `totalPoints`: entry overall points plus current provisional GW live points.
- `projectedRank`: local resort inside the mini-league using provisional live total.
- autosub: official `automatic_subs` is used when available; otherwise a best-effort formation-safe substitution is attempted only after a starter has definitely finished on 0 minutes.

## Graceful fallback

- League-level bootstrap/standings/live failure fails the request.
- Per-entry hydration failure produces a partial row instead of removing the manager from the table.
- Empty states and error banners are rendered in the dashboard.
