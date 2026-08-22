# FPL Live — Codebase Onboarding Guide

> 이 문서는 처음 이 저장소를 보는 엔지니어를 위한 사전지식 문서입니다.
> 코드 수정 전 반드시 읽어주세요.
>
> Last analyzed: 2026-03-21

## 1. Project Overview

FPL(Fantasy Premier League) classic mini-league live dashboard. Uses official FPL public JSON endpoints to show provisional gameweek points, projected rank changes, and each squad's current live status.

- **Status**: MVP complete
- **Users**: FPL managers who want to track their mini-league in real-time
- **Data source**: Premier League official API (no auth required for public leagues)

## 2. Tech Stack

| Category | Technology | Version |
|----------|-----------|---------|
| Framework | Next.js (App Router) | 15.x |
| Language | TypeScript (strict) | 5.8 |
| Styling | Tailwind CSS | v4 |
| Data Fetching | TanStack React Query | 5.x |
| Table | TanStack React Table | 8.x |
| Validation | Zod | 3.x |
| Testing | Vitest + Testing Library + jsdom | 3.x |
| Font | Manrope (Google Fonts) | - |

## 3. Getting Started

```bash
# Install
npm install

# Create env file (or just use defaults)
cp .env.example .env.local

# Dev server
npm run dev
# Open http://localhost:3000

# Test
npm run test

# Build
npm run build && npm run start
```

### Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `NEXT_PUBLIC_APP_URL` | App public URL | `http://localhost:3000` |
| `FPL_BASE_URL` | FPL API base URL | `https://fantasy.premierleague.com/api` |
| `NEXT_PUBLIC_BUILD_ID` | Build identifier (auto-set on Vercel/Railway) | `dev` |

## 4. Directory Structure

```
fpl-live/
  app/
    page.tsx                          # Home: league ID input form
    layout.tsx                        # Root layout (font, QueryProvider)
    globals.css                       # CSS variables, Tailwind import
    league/[leagueId]/page.tsx        # League dashboard route
    api/
      league-live/route.ts            # Live league data API endpoint
      league-rank-change/route.ts     # Rank change history API endpoint

  lib/                                # Server-side core logic
    fpl-client.ts                     # FPL API fetch wrapper (Zod-validated)
    league-aggregator.ts              # Joins standings + picks + live data
    rank-change-aggregator.ts         # GW-by-GW rank history builder
    scoring.ts                        # Scoring engine (captain, autosub, rank)
    types.ts                          # Shared TypeScript types
    validators.ts                     # Zod schemas for FPL API responses

  components/                         # React UI components
    league-dashboard.tsx              # Main dashboard (3 tabs)
    league-table.tsx                  # Standings table + TanStack Table
    rank-change-panel.tsx             # SVG rank chart + stats cards
    fixtures-panel.tsx                # Match fixtures / results
    captain-stats.tsx                 # Popular captain picks (top 3)
    league-row.tsx                    # Table row + expanded view
    player-chip.tsx                   # Individual player card
    squad-strip.tsx                   # Squad display (starters + bench)
    filters.tsx                       # Search / filter controls
    league-search-form.tsx            # Home search form
    query-provider.tsx                # React Query client setup
    refresh-indicator.tsx             # Build ID display (currently unused)

  tests/
    scoring.test.ts                   # Unit tests for scoring logic

  docs/
    design.md                         # Data flow & cache strategy notes
```

## 5. Data Flow

```
Browser
  |
  |-- /league/[leagueId]
  |     |
  |     LeagueDashboard (client component)
  |       |
  |       |-- Tab: "standings" / "fixtures"
  |       |     React Query --> GET /api/league-live?leagueId=...&gw=current
  |       |       |
  |       |       league-aggregator.ts
  |       |         |-- getBootstrapStatic()     (players, teams, events)
  |       |         |-- getAllStandings()         (league members & totals)
  |       |         |-- getFixtures()            (current GW fixtures)
  |       |         |-- getEventLive()           (live stats per player)
  |       |         |-- per manager:
  |       |         |     getEntry() + getEntryPicks()
  |       |         |
  |       |         |-- scoring.ts
  |       |              calculateLiveScore()
  |       |              computePlayersPlayed()
  |       |              splitSquad()
  |       |              computeProjectedRanks()
  |       |
  |       |-- Tab: "rank-change"
  |             React Query --> GET /api/league-rank-change?leagueId=...
  |               |
  |               rank-change-aggregator.ts
  |                 |-- getBootstrapStatic()
  |                 |-- getAllStandings()
  |                 |-- per manager: getEntryHistory() + getEntryPicks()
  |                 |-- buildTrendData()  (GW-by-GW rank recalculation)
```

### FPL API Endpoints Used

| Endpoint | Purpose |
|----------|---------|
| `/bootstrap-static/` | All players, teams, events |
| `/leagues-classic/{id}/standings/` | League members & total points |
| `/entry/{id}/` | Manager summary |
| `/entry/{id}/event/{gw}/picks/` | Manager's GW picks |
| `/entry/{id}/history/` | Manager's GW-by-GW history |
| `/event/{gw}/live/` | Live stats for all players |
| `/fixtures/` | All fixtures |

### Cache Strategy

- Next.js server fetches: `revalidate: 30` (30 second stale time)
- Manual refresh (`?refresh=1`): switches to `no-store`
- React Query: `staleTime: 30_000`, auto-refetch disabled

## 6. Key Business Logic

### Scoring (`lib/scoring.ts`)

- **Captain resolution**: If captain has 0 minutes and fixture is finished, falls back to vice-captain
- **Triple captain**: 3x multiplier on captain points
- **Bench boost**: All 15 players count
- **Autosub**: Uses official `automatic_subs` when available; fallback logic respects formation constraints (min DEF/MID/FWD) only after all fixtures finish
- **GW points**: Sum of live points with captain multiplier (transfer cost NOT deducted from lineup display, only from total)
- **Total points**: `officialTotalBeforeLive + liveGross`
- **Projected rank**: Re-sorts within mini-league by provisional live total

### Provisional Bonus

- `league-aggregator.ts` calculates provisional BPS-based bonus for in-progress fixtures
- Added on top of `total_points` from FPL live data

## 7. Code Conventions

- Path alias: `@/*` maps to project root
- TypeScript strict mode
- Tailwind CSS v4 utility classes (CSS variables for theming in `globals.css`)
- Zod validation on all FPL API responses
- Components: function components, no class components
- UI language: Mixed (English for standings tab, Korean for rank-change and fixtures tabs)
- No ESLint config file present (script exists in package.json)

## 8. Testing

Current coverage: `tests/scoring.test.ts` only.

Tests cover:
- Captain multiplier and vice-captain fallback
- Players played counting
- GW live points with transfer hit
- Projected rank (with tie-breaking)
- Starters/bench split display
- Autosub fallback after fixtures finish

**Not covered**: API routes, aggregator logic, components, E2E flows.

Run: `npm run test`

## 9. Known Issues & Technical Debt

### Must-Know

1. **Large league performance**: All manager data is fetched sequentially per entry. A 100+ member league makes 200+ API calls to FPL per request.
2. **No FPL rate limit handling**: No retry/backoff logic for 429 responses.
3. **Autosub accuracy**: Provisional model may differ from official post-deadline reconciliation.
4. **Private leagues not supported**: No authentication flow exists.

### Code Quality

1. **Duplicate code**: `chipLabel()` in `league-table.tsx` and `league-row.tsx`; `getCurrentGw()` in `league-aggregator.ts` and `rank-change-aggregator.ts`
2. **Unused dependency**: `date-fns` in package.json but no imports found in source
3. **Unused component**: `refresh-indicator.tsx` is not imported anywhere
4. **No ESLint config**: `next lint` script exists but no `.eslintrc` or equivalent
5. **UI language inconsistency**: Standings tab in English, rank-change/fixtures in Korean

### Possible Bug

- `fixtures-panel.tsx:170`: `{fixtureStatus(fixture)} ? {kickoffDateTimeLabel(...)}` - the `?` appears to be a literal character, not a ternary operator. May be a display bug.

## 10. Deployment

### Vercel
1. Import repo into Vercel
2. Set `NEXT_PUBLIC_APP_URL` to deployed URL
3. Deploy with standard Next.js preset

### Railway
1. Create service from repo
2. Set `NEXT_PUBLIC_APP_URL`
3. Build: `npm install && npm run build`
4. Start: `npm run start`

## 11. Planned Improvements (from README)

- Richer fixture state badges
- Player detail drawer (using `element-summary` endpoint)
- Pagination/virtualization for large leagues
- Playwright E2E tests
- Dark mode

---

## 12. 추가 확인이 필요한 불명확한 점

1. **Autosub 부분 경기일 처리**: `buildFallbackAutomaticSubs()`가 일부 픽스처만 완료된 경기일 중간에 올바르게 작동하는가?
2. **대형 리그 타임아웃**: API 호출이 몇 명까지 가능한가? Next.js Route Handler 기본 타임아웃 미설정.
3. **동점 처리**: `computeProjectedRanks()` 동점 시 정렬 기준이 명확한가?
4. **모바일 UX**: 순위 변동 SVG 차트 소형 화면 렌더링 미검증.
5. **비공개 리그 로드맵**: 향후 FPL OAuth 지원 계획이 있는가?
6. **부캡틴 엣지 케이스**: 캡틴이 0분 출장이나 경기 미완료 상태일 때, 부캡틴 픽스처도 완료되고 0분이면 어떻게 처리되는가?

---

## 13. 빠른 시작 체크리스트

```
[ ] npm install 완료
[ ] .env.local 파일 생성 (.env.example 복사)
[ ] npm run dev 실행 후 http://localhost:3000 확인
[ ] FPL 공개 리그 ID 입력 테스트
[ ] npm run test 실행 — scoring.test.ts 전부 통과 확인
[ ] lib/scoring.ts → lib/league-aggregator.ts → lib/fpl-client.ts 순서로 코어 로직 읽기
[ ] docs/design.md 읽기 (데이터 흐름 다이어그램)
```

---

*분석 기준 브랜치: `main` (946cd81) | 분석일: 2026-03-21*
