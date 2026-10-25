# FPL Live — Handover (2026-10-25)

FPL(Fantasy Premier League) 공개 클래식 미니리그의 실시간 순위·잠정 점수·선수 데이터·가격 변동을 보여주는 Next.js 대시보드.
공식 FPL 공개 JSON API만 사용하며 로그인/인증이 없다. UI는 한국어 기본 + 영어 토글.

- 저장소: https://github.com/chanyong/fpl-live (`main` 브랜치 하나, push = 배포 트리거)
- 운영: Railway — https://fpl-live-production-34f4.up.railway.app (Vercel 배포 설정도 README에 있음)
- 이 문서가 현재 기준이다. `CODEBASE_ONBOARDING*.md` 는 3~4월 스냅샷이라 일부(레이트리밋·타임아웃 미처리 등)는 이미 해결됨.

---

## 1. 스택 / 실행

| 분류 | 내용 |
|---|---|
| 프레임워크 | Next.js 15.5.12 App Router (버전 고정 — fetch 캐시 이슈로 올리지 말 것) |
| 언어 | TypeScript strict, `any` 금지 |
| UI | React 19, Tailwind CSS v4 (`app/globals.css` 의 CSS 변수로 테마) |
| 데이터 | TanStack Query v5 (클라이언트), Zod (FPL 응답 검증) |
| 테스트 | Vitest + jsdom (`tests/`, 100+ 케이스) |

```bash
npm install
cp .env.example .env.local
npm run dev        # http://localhost:3000
npm test           # vitest run
npx tsc --noEmit   # 타입 체크 (lint 설정 없음)
npm run build
```

환경변수(`.env.example`): `NEXT_PUBLIC_APP_URL`, `FPL_BASE_URL`, `FPL_TIMEOUT_MS`(10000), `FPL_MAX_ATTEMPTS`(3), `FPL_PICKS_CONCURRENCY`(8), `NEXT_PUBLIC_BUILD_ID`.

---

## 2. 화면 구성

| 경로 | 내용 |
|---|---|
| `/` | 리그 ID 입력 (`home-hero`, `league-search-form`, `league-id-links`) |
| `/league/[leagueId]` | 리그 대시보드 (`components/league-dashboard.tsx`) |
| `/price-changes` | 리그 ID 없이 보는 공개 가격 변동 페이지 (SEO 용) |

### 리그 대시보드 탭 (`league-dashboard.tsx`)

| 탭 | 서브 탭 | 컴포넌트 | 데이터 |
|---|---|---|---|
| 주간 순위 | 경기 일정 (기본) | `FixturesPanel` (경기별 리그 보유 선수 스탯) | `/api/league-live` (30초 자동 갱신) |
| | 순위표 | `LeagueTable` + 사이드(`LeagueKpis`, `CaptainStats`) | `/api/league-live` |
| | 순위 추이 | `RankChangePanel` (SVG 차트, 칩 현황, 시즌 요약) | `/api/league-rank-change` (선택 시 lazy) |
| 팀 | (없음) | `TeamFixtureTable` + `PremierLeagueTable` | `/api/player-stats` |
| 선수 | 이적 시장 / 선수 성과 / 우리 리그 | `PlayerTrendsPanel` → `PriceChangesSection`, `PlayerDetail`, `DifferentialList` … | `/api/player-stats`, `/api/price-changes` |

> 2026-10-25: '경기 일정'을 '팀' 탭에서 '주간 순위'의 첫 번째(기본) 서브 탭으로 옮기고, 하나만 남은 '팀' 탭의 서브 탭을 없앴다.

공통: `DeadlineBanner`(다음 데드라인), `RefreshIndicator`(강제 새로고침 = `?refresh=1`), `ShareButton`, `LocaleToggle`.

---

## 3. API 라우트 (`app/api/*/route.ts`)

| 라우트 | 하는 일 | 핵심 lib |
|---|---|---|
| `league-live` | 리그 순위 + 매니저별 picks/라이브 점수/오토서브/잠정 순위 | `league-aggregator.ts`, `scoring.ts` |
| `league-rank-change` | GW별 순위 추이, 칩·벤치·팀가치 등 시즌 요약 | `rank-change-aggregator.ts`, `season-summary.ts`, `chips.ts` |
| `player-stats` | 선수 표·리그 보유율·유효 소유율·FDR·EPL 순위표 | `player-stats.ts`, `player-metrics.ts`, `pl-table.ts` |
| `player-points` | 선수 1명의 GW 점수 항목별 내역 (`explain` 기반) | `player-points.ts` |
| `player-history` | 선수 1명의 GW 이력 (`element-summary`) — 열 때만 호출 | |
| `price-changes` | 가격 변동 예측 + 실제 변동 이력 + 다음 갱신 시각 | `player-stats.ts#getPriceChangeData`, `price-changes.ts` |

입력 검증은 `lib/request-params.ts` (리그/선수 ID는 양의 정수만 upstream 으로).

---

## 4. 데이터 / 캐시

- **모든 FPL 호출은 `lib/fpl-client.ts` 경유**: 요청 타임아웃, 429/408/5xx·네트워크 오류 지수 백오프 재시도(`Retry-After` 준수), 응답은 `lib/validators.ts` Zod 스키마로 파싱. 매니저별 fan-out은 `lib/concurrency.ts` 로 동시 8개 제한.
- 서버 캐시: 각 aggregator 의 인메모리 Map (league-live·player-stats 30초, price-changes 60초). 영속 캐시 없음 → 인스턴스 재시작 시 초기화.
- 클라이언트: React Query (`components/query-provider.tsx`).

사용 FPL 엔드포인트: `bootstrap-static`, `leagues-classic/{id}/standings`, `entry/{id}`, `entry/{id}/history`, `entry/{id}/event/{gw}/picks`, `event/{gw}/live`, `fixtures`, `element-summary/{id}`, **`stats/price-changes`**.

---

## 5. 점수 모델 (`lib/scoring.ts`, `lib/player-points.ts`)

- 잠정 총점 = 공식 총점 − 공식 현재 GW 점수 + 잠정 라이브 GW 점수 (이중 합산 방지).
- 주장 0분 + 경기 종료 → 부주장 배수. 오토서브는 포메이션 제약을 지키는 best-effort 모델 → 공식 확정값과 다를 수 있음(UI에 "잠정" 표기).
- 잠정 보너스는 **FPL이 아직 보너스를 매기지 않은 경기에만** 추정 (보너스 행이 생기면 이미 `event_points` 에 포함됨). 더블 GW는 경기별 판단.
- `projectedRank` 는 표준 경쟁 순위(1,1,1,4). 공식 순위는 표시 순서 타이브레이크에만 쓴다.

---

## 6. 가격 변동 (2026-10-25 공식 사이트 기준으로 재작성)

공식 페이지 `fantasy.premierleague.com/en/price-changes` 의 번들 로직을 그대로 따른다.

**예측 표**
- 대상: `status !== "u"` 인 전체 선수 (출전 시간 0인 선수 포함 — 예전엔 `minutes > 0` 만 보여서 공식과 달랐음).
- 상태: `price_change_projections[0].likelihood` 로 FPL이 직접 판정 → `5` 상승 매우 유력 / `4` 상승 유력 / `-4` 하락 유력 / `-5` 하락 매우 유력 / 그 외 변동 가능성 낮음. (예전의 ±95/±100 컷 추정은 폐기)
- 잠금(`price_change_locked_until`) → "N일 후 잠금 해제", `price_change_calibrating` → "보정 중".
- 열: 선수 / 상태 / 진행률(`price_change_percent`) / 예상 진행률(`projections[0].projected_percent`) / 소유 추세(`transfers_in_event` vs `out`) / 현재가.
- 기본 정렬: |진행률| 내림차순. 필터: 상승·하락·잠금, 포지션, 검색.
- 다음 갱신 카운트다운: `bootstrap-static.game_config.settings.price_change_deadlines` 중 미래의 첫 값 (보통 00:00 UTC = 09:00 KST).

**최근 가격 변동 표**
- `stats/price-changes/` 의 실제 기록(`changed_at`, `cost_before`, `cost_after`) 사용 — 날짜가 있다. (예전엔 `cost_change_event` 로 추정해 날짜가 없었음)
- 기본 정렬: 날짜 내림차순, 같은 시각은 이름순.

코드: `lib/price-changes.ts`(판정·정렬), `lib/player-stats.ts#getPriceChangeData`(조합·캐시), `components/price-changes-section.tsx`(UI, `/api/price-changes` 를 직접 조회 — 리그 탭과 공개 페이지가 같은 데이터를 본다).

미구현: 공식의 "Last updated" 시각(소스 필드 위치 미확인), 내 팀 구매가/판매가(로그인 필요).

---

## 7. SEO / 기타

- `app/layout.tsx`: GA4 태그, Google Search Console 인증 메타.
- `app/opengraph-image.tsx`, `app/sitemap.ts`, `app/robots.ts`, `lib/site.ts`(canonical origin).
- 파비콘: `app/favicon.ico`, `app/icon.png`, `app/apple-icon.png` — 녹색(`--accent` #0b6e4f) 배경 + 흰 "F" (EPL 사자 아이콘과 구분). 다시 만들려면 PIL로 같은 규격 생성.
- `docs/blog/` 한/영 SEO 글 20편 + 이미지. ⚠️ ko/03·04, en/03·04 는 옛 ±95/±100 전망 기준을 설명하므로 6절 기준으로 고쳐야 함.
- `docs/design.md`, `docs/marketing.md`.

---

## 8. 작업 규칙

- 변경마다 `main` 에 커밋 + push (Railway 자동 배포). 자기 파일만 stage (Windows 쪽 CRLF 노이즈 주의).
- 로컬 작업 폴더가 Dropbox(`~/Library/CloudStorage/Dropbox/20_Dev/fpl-live`)에 있다. 파일이 "온라인 전용"이 되면 읽기/`git` 이 `Resource deadlock avoided` 로 실패 → Finder에서 폴더를 "오프라인 사용 가능"으로 두거나, GitHub에서 clone 해서 작업. Dropbox 폴더는 작업 후 `git pull` 로 맞출 것.
- 커밋 전: `npx tsc --noEmit && npm test` (빌드 확인은 `npm run build`).
- 새 FPL 필드는 반드시 `validators.ts` 스키마에 추가(없으면 Zod가 버림).

---

## 9. 알려진 한계 / 다음 후보

- 비공개 리그 미지원(인증 없음), Playwright E2E 없음, 영속 서버 캐시 없음.
- 대형 리그(수백 명)는 picks/history fan-out 이 느림 — 동시성 제한만 있고 페이지네이션/가상화 없음.
- 오토서브·보너스는 잠정 모델.
- 블로그 가격 변동 글 갱신(7절).
