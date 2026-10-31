# FPL Live — Handover (2026-10-30 갱신)

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
| `/faq` | 자주 묻는 질문 (한국어, FAQPage JSON-LD) |
| `/privacy`, `/terms` | 개인정보처리방침·이용약관 (한/영 토글, 초안 — 법률 검토 전) |

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

## 의견·질문 버튼 (2026-10-28)
- 모든 공개 페이지 오른쪽(또는 왼쪽) 아래에 운영자 사이트 공통 '의견·질문' 버튼이 있다. `<script src="https://ddalkkakrank.kr/feedback.js" defer ...>` 한 줄(`app/layout.tsx`, 한/영 전환을 따라감).
- 방문자가 보낸 유형·내용·선택 연락처·페이지 주소는 딸깍랭크(ai-ranking 저장소) 서버의 의견함 `site_feedback` 에 모이고, 관리자 화면 `https://ddalkkakrank.kr/admin/feedback` 에서 본다. 허용 출처는 ai-ranking `src/lib/feedback.ts` 의 `SITES` — **도메인을 바꾸면 거기에도 추가**해야 접수된다.
- 언어는 `<html lang>` 을 따라 한국어/영어 자동. 버튼 위치·숨김 옵션(`data-side`, `data-avoid`, `data-hide`)은 feedback.js 맨 위 주석 참고.

## 2026-10-30 개선 (이메일 개선안 자동 승인분)

**한 일**
- 공유·SEO: `/league/{id}` 제목 `"{리그명} 실시간 순위 · GW N | FPL Live"`, description 70~120자(`lib/seo-text.ts`, 테스트 있음), canonical·og·twitter. 리그별 동적 OG 이미지 `app/league/[leagueId]/opengraph-image.tsx`(리그명·현재 GW). 루트 OG 도 한국어로. 한글 글꼴은 Google Fonts 에서 필요한 글자만 받아 씀(`lib/og-font.ts`), 실패하면 영어 문구로 대체(`lib/og-card.tsx`).
- 제목의 `&`(HTML 에서 `&amp;` 로 보이던 것) 제거, 기본 title·description 한국어로. 하위 페이지(가격 변동·FAQ·처리방침·약관)에 og:image 명시.
- FPL 호출량: 메타·OG 는 `lib/league-meta.ts` 메모리 캐시(리그명 30분, 현재 GW 10분, 동시 요청 합치기) → 예전(페이지 열 때마다 standings 1회)보다 줄어듦. 기존 30초/60초 캐시·동시성 8 그대로.
- 최근 본 리그 목록(최대 6개, localStorage `fpl-live-recent-leagues`, 옛 `recentLeagueId` 자동 이전) — 첫 화면에 이름·ID·삭제 버튼. "리그 ID 찾는 법" 펼침 안내(웹 단계 + 주소창 그림, 앱 초대코드 주의).
- 보너스 예상: 경기 카드마다 BPS 기준 3·2·1(동점 같은 점수, 3위 동점 모두 1점으로 수정) "보너스 예상", FPL 이 확정하면 "보너스 확정"(`lib/bonus.ts`). 잠정 점수 계산도 같은 함수 사용.
- "내 라이벌과 점수 차" 카드(`components/rival-card.tsx`): 나·라이벌을 고르면 GW 점수 차·잠정 총점 차·순위·주장·나만/라이벌만 가진 선발 표시. 2026-10-31(#2)부터 선택을 저장하지 않는다 — 페이지를 새로 열면 '선택'으로 시작하고, 같은 화면에서는 자동 갱신·탭 전환 뒤에도 유지(선택은 카드가 아니라 `league-dashboard.tsx` 의 `useRivalPick` 이 보관). 예전 저장 키 `fpl-live-rival:*` 는 열 때 지운다.
- "GW N 순위 변화"(경기 후/진행 중) 카드: FPL `last_rank` → 잠정 순위, 많이 오른/내린 3명, GW 최고점(`lib/rank-movement.ts`). `validators.ts` standings 에 `last_rank` 추가.
- 데이터 배지: 리그 화면 상단 "마지막 갱신 · 출처 FPL 공식 공개 API · 기준 GW N 잠정 점수".
- 공통: 처리방침·약관(한/영), 푸터 링크, "운영자의 다른 서비스" 상호 링크, JSON-LD WebSite+Organization(+기존 WebApplication), FAQPage, sitemap 에 /privacy·/terms.
- 가격 예측 적중률: 저장소가 없어 **기록 구조만** 만듦(`lib/price-prediction-log.ts`). 환경변수 `PRICE_PREDICTION_LOG_DIR`(예: Railway 볼륨 경로)를 넣으면 가격 갱신마다 마지막 예측(가능성 ±4·±5)을 `<갱신시각>.json` 으로 저장(10분에 1번, 추가 FPL 호출 없음). `evaluateSnapshot()` 이 `stats/price-changes` 실제 변동과 비교해 적중·방향 틀림·변동 없음·놓침·정밀도·재현율 계산. 화면 표시는 아직 없음.

- 첫 화면 위쪽 작은 제목("공식 FPL 라이브 대시보드")이 모바일에서 세로로 깨지던 것 수정: 한 줄 고정, 모바일 글자·자간 축소, 버튼은 공간이 모자라면 다음 줄로(`components/home-hero.tsx`).

**남은 할 일**
- (사용자) 적중률을 쌓으려면 Railway 서비스에 볼륨을 붙이고 `PRICE_PREDICTION_LOG_DIR` 설정 → 며칠 쌓인 뒤 적중률 API/화면 추가.
- (사용자) 처리방침·약관 법률 검토, 후원 링크(넣지 않았음), 서치콘솔 sitemap 재제출.
- FAQ 의 `[확인 필요]` 2곳(초대 전용 리그, 유료화 정책).
- 블로그 가격 변동 글 갱신(7절).

## 네이버 서치어드바이저 (2026-10-30)

- https://fpl-live-production-34f4.up.railway.app 를 네이버 서치어드바이저(웹마스터 도구, 운영자 네이버 계정)에 등록. 소유 확인은 HTML 태그 방식 — `<meta name="naver-site-verification">` 를 `app/layout.tsx` 의 `metadata.verification.other` 에 넣음(지우면 소유 확인이 풀림). 소유 확인 후 sitemap 제출.

### 2026-10-30 디자인 점검 반영 (`98f901d`)
- 히어로 라벨 '공식 FPL 라이브 대시보드'(대문자·넓은 자간) → 'FPL 라이브 대시보드'(비공식 팬 서비스와 맞춤), body `word-break: keep-all`. 전체 점검 리포트: `~/.gstack/projects/gstack-github/designs/design-audit-20261030/design-audit-11-sites.md`

## 배포 기록

| 배포 시각 | 브랜치 | 내용 |
|---|---|---|
| 머지 시 | `design/taste-pilot` | 홈 첫 화면을 경기 입장권 구성으로 개편(taste-skill 시범, 홈 전용 `.home-*` 토큰·클래스, 리그 화면 미변경). 리뷰 반영: 오류 문구로 휴대폰 화면이 넓어지던 grid 수정(`minmax(0,1fr)`), 홈 배경 화면 높이 채움, 제목 첫 화면 즉시 표시(LCP), 입력란 포커스 링·오류 배경·고대비 모드 포커스, 버튼 굵기 실제 적용(`!`), 긴 최근 리그 이름 말줄임. |

### 2026-11-01 하단 '운영자의 다른 서비스' 카드 띠 (#4, 공통 사양 chanyong/ddalkkak-rank#12)
- 푸터 맨 위(법적 고지 위)에 카드 띠: 10곳(FPL Live 자신 제외), 2/3/5열, 이름 16px·설명 14px. 목록·utm(`utm_source=fpl&utm_medium=footer_network`)은 `lib/network.ts` 한 곳, 화면은 `components/site-footer.tsx`. 도메인을 바꾸면 `lib/network.ts` 의 FPL Live 주소와 `SELF_URL` 도 같이 바꾼다.
