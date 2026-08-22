# FPL Live Dashboard — Codebase Onboarding (2026-04-19)

## 프로젝트 목적

Fantasy Premier League(FPL) 미니리그의 실시간 순위·득점 현황을 보여주는 Next.js 웹 대시보드.
공식 FPL 공개 API를 집계해 라이브 경기 중에도 잠정 순위와 점수를 표시한다.
현재 공개 클래식 리그만 지원(인증 불필요).

---

## 기술 스택

| 분류 | 기술 |
|------|------|
| 프레임워크 | Next.js 15.5.12 (App Router) |
| 언어 | TypeScript 5.8 (strict) |
| UI | React 19, Tailwind CSS v4 |
| 데이터 관리 | TanStack Query v5, TanStack Table v8 |
| 유효성 검사 | Zod |
| 테스트 | Vitest + jsdom + @testing-library |
| 배포 | Vercel / Railway (환경변수로 구분) |

---

## 실행 / 테스트 / 배포

```bash
# 개발 서버
npm run dev          # http://localhost:3000

# 테스트 (scoring.ts 단위테스트)
npm test

# 빌드
npm run build
npm start

# 린트 (ESLint 설정 파일 없음 — next lint 스크립트만 존재)
npm run lint
```

### 환경변수 (`.env.local`)

| 변수 | 기본값 | 용도 |
|------|--------|------|
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | 공개 URL |
| `FPL_BASE_URL` | `https://fantasy.premierleague.com/api` | FPL API base |
| `NEXT_PUBLIC_BUILD_ID` | `dev` | Vercel/Railway 빌드 ID |

---

## 핵심 디렉터리와 엔트리포인트

```
fpl-live/
├── app/
│   ├── page.tsx                    # 홈: 리그 ID 입력 폼
│   ├── layout.tsx                  # 루트 레이아웃 (폰트, QueryProvider)
│   ├── api/
│   │   ├── league-live/route.ts    # GET /api/league-live  ← 핵심 API
│   │   └── league-rank-change/route.ts  # GET /api/league-rank-change
│   └── league/[leagueId]/page.tsx  # 리그 대시보드 페이지
│
├── components/
│   ├── league-dashboard.tsx        # 메인 컨테이너 (탭 전환, React Query)
│   ├── league-table.tsx            # 순위표 (TanStack Table)
│   ├── league-row.tsx              # 행 + 펼치기 트리거
│   ├── rank-change-panel.tsx       # SVG 순위 추이 차트
│   ├── fixtures-panel.tsx          # 경기 일정 + 선수 스탯
│   ├── captain-stats.tsx           # 상위 3 주장 통계
│   ├── squad-strip.tsx             # 선발/벤치 레이아웃
│   └── player-chip.tsx             # 선수 카드
│
└── lib/
    ├── fpl-client.ts               # FPL API fetch 래퍼
    ├── league-aggregator.ts        # 메인 집계 로직 (476줄)
    ├── rank-change-aggregator.ts   # 순위 추이 집계 (193줄)
    ├── scoring.ts                  # 득점 계산 엔진 (361줄)
    ├── types.ts                    # 공유 타입 정의
    └── validators.ts               # Zod 스키마
```

---

## 데이터 흐름

```
브라우저
  └─ LeagueDashboard (client)
       ├─ React Query: GET /api/league-live  (60초 자동 갱신)
       └─ React Query: GET /api/league-rank-change  (탭 전환 시 lazy)

서버 (Route Handler)
  └─ league-aggregator.getLeagueLivePayload()
       ├─ FPL API: bootstrap-static  (선수·팀·이벤트 메타)
       ├─ FPL API: leagues-classic/{id}/standings  (리그 참가자)
       ├─ FPL API: fixtures  (전체 경기 일정)
       ├─ FPL API: event/{gw}/live  (라이브 선수 스탯)
       └─ 참가자별 병렬:
            ├─ FPL API: entry/{id}/event/{gw}/picks  (선택 선수)
            └─ scoring.ts: calculateLiveScore()  → 잠정 점수
```

### 캐시 전략

| 레이어 | TTL | 비고 |
|--------|-----|------|
| Next.js fetch (서버) | 30초 revalidate | `?refresh=1` → no-store |
| 인메모리 Map (서버) | 30초 TTL | `leagueLiveCache` (중복 요청 방지) |
| React Query (클라이언트) | staleTime 30초 | refetchInterval 60초 |

---

## 주요 모듈 관계

```
league-aggregator.ts
  → fpl-client.ts        (HTTP 요청)
  → validators.ts        (Zod 파싱)
  → scoring.ts           (점수 계산)
  → types.ts             (공유 타입)

scoring.ts
  → types.ts (ScoringContext, EffectiveLineup, Chip 등)

API Route → league-aggregator → 응답 반환
Components → React Query 훅 → API Route
```

---

## 득점 계산 핵심 (scoring.ts)

1. **`calculateLiveScore()`** — 주장 해결 + 오토서브 + 배수 적용 → `gwPoints`, `totalPoints`
2. **`buildFallbackAutomaticSubs()`** — 전체 경기 종료 시에만 작동, 포메이션 제약 준수
3. **`computeProjectedRanks()`** — 잠정 총점 기준 재정렬 (동점 시 공식 순위 유지)
4. **주장 폴백** — 주장이 0분 + 경기 종료 → 부주장이 2배 적용

---

## 코드 규칙과 주의사항

- **TypeScript strict 모드** — `any` 사용 금지, Zod 런타임 검증 필수
- **서버/클라이언트 분리** — `lib/`는 서버 전용, `components/`는 클라이언트
- **FPL API 직접 호출 금지** — 항상 `fpl-client.ts` 래퍼 경유
- **캐시 무효화** — `?refresh=1` 파라미터로 강제 갱신 가능
- **CSS** — Tailwind CSS v4 유틸리티 클래스 사용, CSS 변수(globals.css)로 테마 관리

---

## TODO / FIXME / 기술부채 / 리스크

### 🔴 Critical

| 항목 | 위치 | 내용 |
|------|------|------|
| 대형 리그 성능 | league-aggregator.ts | 100명+ 리그 → 200+ API 호출/요청, 순차 처리 |
| Rate limit 미처리 | fpl-client.ts | 429 응답 재시도/백오프 로직 없음 |

### 🟡 Medium

| 항목 | 위치 | 내용 |
|------|------|------|
| 오토서브 정확도 | scoring.ts | 잠정 모델 ≠ 공식 마감 후 확정값 |
| 비공개 리그 미지원 | 전체 | 인증 플로우 없음 |
| 표시 버그 의심 | fixtures-panel.tsx:170 | `?` 문자 — 삼항 연산자 의도 여부 확인 필요 |
| API 타임아웃 미설정 | Route Handler | 명시적 타임아웃 없음 |

### 🟢 Low (코드 품질)

| 항목 | 위치 |
|------|------|
| `chipLabel()` 함수 중복 | league-table.tsx, league-row.tsx |
| `getCurrentGw()` 함수 중복 | league-aggregator.ts, rank-change-aggregator.ts |
| `date-fns` 미사용 의존성 | package.json |
| `refresh-indicator.tsx` 미사용 컴포넌트 | components/ |
| ESLint 설정 파일 없음 | 루트 |
| UI 언어 혼용 | 영어 순위표 / 한국어 순위추이·경기일정 탭 |

---

## 테스트 현황

- **커버리지**: `lib/scoring.ts` 단위테스트 9개만 존재
- **미커버**: API Route, Aggregator 로직, React 컴포넌트, E2E 전체

```bash
npm test   # vitest 실행
```

---

## 외부 의존성 (FPL 공개 API)

| 엔드포인트 | 용도 |
|-----------|------|
| `/bootstrap-static/` | 선수·팀·이벤트 메타 |
| `/leagues-classic/{id}/standings/` | 리그 순위 (페이지네이션) |
| `/entry/{id}/event/{gw}/picks/` | 관리자 GW 선택 + 칩 |
| `/entry/{id}/history/` | 관리자 GW별 이력 |
| `/event/{gw}/live/` | 라이브 선수 스탯 |
| `/fixtures/` | 전체 경기 일정 |

이미지: `resources.premierleague.com` CDN (next.config.ts remotePatterns 등록됨)

---

## 추가 확인이 필요한 불명확한 점

1. **fixtures-panel.tsx:170** — `?` 리터럴 문자가 버그인지 의도인지 확인 필요
2. **오토서브 엣지케이스** — 부분 완료 GW(일부 경기 진행 중)에서 오토서브 정확도
3. **SVG 차트 모바일 반응형** — RankChangePanel 차트의 소형 화면 동작 미확인
4. **동점 순위 처리** — `computeProjectedRanks()` 동점 시 공식 순위 타이브레이크 동작 검증 필요
5. **GW 감지 로직** — `getCurrentGw()`가 현재 GW를 "finished" 이벤트 기준으로 판단 — 시즌 경계 엣지케이스 주의

---

## 최근 커밋 이력 (참고)

| 커밋 | 내용 |
|------|------|
| b024152 | `getCurrentGw` — 현재 GW 종료 시 다음 GW 반환 버그 수정 |
| 16939b8 | FPL API 호출 최소화, 서버 캐시 추가, refresh 버그 수정 |
| 8873010 | fetch 캐시 충돌 수정, Next.js 버전 고정 |
| 800d611 | GW 점수 색상을 Rank 열 → GW 열로 이동 |

---

*이 문서는 2026-04-19 기준 스냅샷입니다. 코드와 불일치할 경우 코드를 우선합니다.*
