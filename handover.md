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
| `entry-ai` | AI 추천(기본 꺼짐, 허용 팀만): 상태 조회(GET)·분석 요청(POST) | `lib/ai/*` |
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
- 파비콘: `app/favicon.ico`, `app/icon.png`, `app/apple-icon.png` — 주색(`--accent` #3a6230) 배경 + 흰 "F" (EPL 사자 아이콘과 구분). 색을 바꿀 때는 PIL로 기존 이미지의 초록만 다시 칠한다(옛 초록→새 초록, 흰색 유지; ico는 16·32·48·64 네 크기 모두). 테스트 `tests/favicon-color.test.ts`.
- 사이트 규칙(#1): 보안 헤더 5종은 `lib/security-headers.ts` → `next.config.ts` `headers()`(CSP는 GA·Plausible·의견 버튼 출처 검토 뒤 따로), `/llms.txt`는 `lib/llms-text.ts`, `theme-color`는 `app/layout.tsx` `viewport`(= `--accent` #3a6230). 본문 글꼴은 Manrope(영문·숫자) 다음에 Pretendard(한글, jsDelivr 동적 서브셋을 `app/layout.tsx` `<head>`에서 불러옴). 테스트 `tests/site-rules.test.ts`.
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

### 2026-11-01 하단 '운영자의 다른 서비스' 카드 띠 (#4, 공통 사양 chanyong/ddalkkak-rank#12)
- 푸터 맨 위(법적 고지 위)에 카드 띠: 10곳(FPL Live 자신 제외), 2/3/5열, 이름 16px·설명 14px. 목록·utm(`utm_source=fpl&utm_medium=footer_network`)은 `lib/network.ts` 한 곳, 화면은 `components/site-footer.tsx`. 도메인을 바꾸면 `lib/network.ts` 의 FPL Live 주소와 `SELF_URL` 도 같이 바꾼다.

## 배포 기록

| 배포 시각 | 브랜치 | 내용 |
|---|---|---|
| 머지 시 | `design/31-journal-redesign` | 일지 화면 개편(#31): 결과 요약 타일(GW 점수 큰 타일·평균/지난주 대비 화살표+글자), 선수 카드(포지션 색 띠·C/VC·출전/교체 상태·벤치 순번), 경기 카드(날짜별·내 선수 강조), 입력칸 라벨·도움말·예시·저장 상태, 최근 주만 펼침. 데이터·API·계산 변경 없음. 선수 사진·클럽 엠블럼은 스냅샷에 없어 약어 원으로 대체. |
| 머지 시 | `design/taste-pilot` | 홈 첫 화면을 경기 입장권 구성으로 개편(taste-skill 시범, 홈 전용 `.home-*` 토큰·클래스, 리그 화면 미변경). 리뷰 반영: 오류 문구로 휴대폰 화면이 넓어지던 grid 수정(`minmax(0,1fr)`), 홈 배경 화면 높이 채움, 제목 첫 화면 즉시 표시(LCP), 입력란 포커스 링·오류 배경·고대비 모드 포커스, 버튼 굵기 실제 적용(`!`), 긴 최근 리그 이름 말줄임. |
| 머지 시 | `design/network-footer` | 하단 '운영자의 다른 서비스'를 카드 띠로 개편(#4, 공통 사양 chanyong/ddalkkak-rank#12): 10곳 2/3/5열, 제목 18px·이름 16px·설명 14px, `utm_source=fpl&utm_medium=footer_network`, 법적 고지·정책 링크는 띠 아래로 분리. 리뷰 반영: 옛 브랜치를 옮기며 배포 기록 표 아래에 붙었던 설명 절을 본문으로 옮기고 표에 이 줄 추가. |
| 머지 시 | `design/taste-all-pages-issue-8` | 전 화면 taste-skill(`--app`) 적용(#8, #6 후속): 경기 입장권 토큰(종이 #eaeae5·잉크 #2a1d17·초록 #3a6230, 반경 6px)을 `app/globals.css` 전역 토큰으로 올리고 패널 그림자·그라데이션·pill 모양 제거. 설명 문구 축약(라이벌 안내문 삭제, '보너스 확정'→'보너스', '지난 GW → 이번 GW' 등, 한/영). 전역 `button,input,select{font:inherit}`를 제거해 버튼·입력 글자 크기 유틸리티가 먹게 함(홈의 `!` 우회 제거), 언어 전환 버튼을 탭과 같은 모양으로, 입력 안내 320px 잘림 해결(짧은 placeholder), 의견 버튼 색을 `data-color=#2a1d17`로 바꿔 초록 칸과 구분. 계산·API·라이벌 선택 동작·하단 띠 미변경. |
| 머지 시 | `fix/issue-1-site-rules` | 사이트 규칙 맞춤(#1): 한글 글꼴 Pretendard, 보안 헤더(HSTS·nosniff·Referrer-Policy·X-Frame-Options SAMEORIGIN·Permissions-Policy), `/llms.txt`, `theme-color` #3a6230. CSP는 미포함. |

## 2026-11-03 GA4 전환 이벤트 (#19)
- 기존 gtag에 이벤트만 더함(새 추적 도구 없음). `lib/analytics.ts`(보내기·검색어 정리·외부 링크 판정), `components/analytics-events.tsx`(문서 클릭 하나로 `outbound_click`·`feedback_open`, 입력이 멈춘 뒤 1.5초에 `search` 한 번).
- `search`: 첫 화면 리그 ID 제출(`search_area=league_id`), 선수 표(`players`)·가격 변동(`price_changes`) 검색어, 리그 순위표 매니저·팀 이름 검색(`league_managers`)은 검색어 없이 횟수만. 이메일·9자리 이상 숫자는 검색어에서 뺀다.
- `outbound_click`: 다른 도메인 http(s) 링크, `link_url`(쿼리·# 제외)·`link_domain`. `feedback_open`: 공통 의견 버튼(`#site-feedback` Shadow DOM의 `.open-btn`) — feedback.js 구조가 바뀌면 `isFeedbackOpenClick` 확인.
- 제휴 링크·알림 신청 기능이 없어 `affiliate_click`·`alert_signup`은 없음. GA4 '핵심 이벤트' 지정은 관제 창 몫. 개인정보처리방침 GA 행에 '기능 이용 기록' 문구 추가. 테스트 `tests/analytics.test.tsx`.

## 2026-11-22 내 스쿼드 보기 (#39 2단계)
- 화면: `/team`(기억한 팀으로 이동 또는 팀 ID 입력), `/team/[entryId]`(`components/squad-page.tsx`). 상단 메뉴 5번째 '내 팀', 리그 순위표 행을 펼치면 '이 팀의 스쿼드' 링크, 홈에 팀 ID 링크. 로그인 없음, '내 팀' 기억은 브라우저 저장소(`lib/my-team.ts`)만.
- API: `GET /api/entry-squad?entryId=&refresh=1`(`lib/entry-squad.ts`). FPL 호출: `entry`·`history`·`transfers`(새 엔드포인트)·`picks`(마지막 마감 GW) + 공용 bootstrap/fixtures(60초 메모, `lib/public-data.ts#getBase`). 팀별 5분 메모리 캐시(최대 200팀), 같은 팀 동시 요청은 한 번만 호출. 프리 힛 주면 그 전 주 팀, 시즌 중 가입 팀은 `element-summary`로 첫 스쿼드 가격 조회.
- 요청 제한(`lib/entry-request-limit.ts`): IP당 분당 20회, 10분에 서로 다른 팀 12개, 같은 팀 새로고침 30초 1회. 초과는 429 + `Retry-After`. 메모리 방식이라 재시작하면 초기화.
- 추정값: 판매가(`lib/selling-price.ts`: 구매가 + 오른 폭의 절반 내림, 구매가는 가장 최근 `element_in_cost`, 보유 중이던 선수는 시작가 = `now_cost - cost_change_start`, 프리 힛 주 이적 제외), 무료 이적 수(`lib/free-transfers.ts`: 공식 규칙문 기준, 칩 주는 적립 없음, 최대 5, 기록과 안 맞으면 경고). 두 값은 화면에 '추정' 표기. 공식 화면 값과의 대조는 로그인이 필요해 대표 본인 팀으로 한 번 확인해야 한다.
- 검색 제외: 두 화면 `noindex`, `robots.ts`의 `/team/` 차단, 사이트맵 미포함. 개인정보처리방침에 행 추가(2026-11-22).
- 못 보는 것: 마감 전에 바꾼 선발·주장·칩(공개 API는 지난 마감 시점만). 마감 전 이적은 공개 목록에 보이면 건수만 안내.

## 2026-11-22 AI 추천 층 (#43 2·3단계, 화면은 다음 PR)
- 기본 **꺼짐**. 켜지려면 `AI_RECOMMEND_ENABLED=true`(정확히 이 값) + `ANTHROPIC_API_KEY` + `SUPABASE_URL`·`SUPABASE_SERVICE_ROLE_KEY`가 모두 있어야 한다. 하나라도 없으면 규칙 기반 결과만(`/api/entry-ai`는 `{status:"disabled"}`). 값은 코드·이슈·로그에 남기지 않는다.
- **끄는 법**: Railway에서 `AI_RECOMMEND_ENABLED`를 지우거나 `false`로 바꾼다(재시작 필요). 급하면 Anthropic 콘솔에서 키를 폐기한다(호출은 `api_auth`로 실패하고 예약 금액만 남는다).
- **상수 위치**: `lib/ai/config.ts` 한 파일. 허용 팀 `ALLOWED_ENTRY_IDS`(지금 4300767만), 월 상한 `MONTHLY_CAP_USD`(40), 일 상한 `DAILY_CAP_USD`(5)·`DAILY_CALL_CAP`(10), 모델 ID·단가·`AI_MAX_TOKENS`·`AI_EFFORT`, 키당 세대 수 `MAX_GENERATIONS_PER_KEY`(3). 상한을 올리면 건당 예약액(`lib/ai/budget.ts#maxCostPerCallUsd`, 지금 $0.864 = 입력 28,000자를 1자 1토큰으로 본 $0.224 + 출력 16,000토큰 $0.64. 11-22 첫 실제 호출: 약 20,650자가 14,158토큰, 출력 2,422토큰, 실제 $0.21)과 DB 함수 인자는 코드에서 넘기므로 함수 수정은 필요 없다.
- **DB**: `db/migrations/0002_ai_recommendations.sql`(롤백 `.rollback.sql`). 표 3개(`ai_recommendations` 작업·결과, `ai_usage` 사용량, `ai_recommendation_log` 추천 기록 — 5단계에서 쓴다)와 상한 집행 함수(`ai_start_job`, `ai_reserve_usage`). **운영 DB에 먼저 적용(관제 창, L2)한 뒤 PR 병합.** 표가 없으면 호출 전에 읽기가 실패해 호출하지 않는다(fail closed).
- 흐름: `POST /api/entry-ai`(저장본 있으면 그대로, 없으면 작업 생성 + 호출 전 DB 예약 후 202) → 서버가 같은 프로세스에서 스트리밍으로 받아 검증된 완성본만 저장 → `GET /api/entry-ai?entryId=&locale=`로 상태(`none|pending|done|failed|disabled|not_allowed|limit`). 백그라운드 자동 실행·cron 없음. 15분 넘게 running인 작업은(호출 1건 기한 6분 × 최대 2건 + 여유 3분) 조회 때 failed로 정리되고 그 예약 금액은 누적에 남는다.
- 사용량 확인(콘솔 대신 DB): `select date_trunc('month', created_at), sum(cost_usd) from ai_usage group by 1;`

## 2026-11-22 추천 화면 (#43 4단계)
- `/team/4300767`에만 추천 패널(선발·캡틴·이적 시나리오, 그 아래 AI 의견)이 보인다. 다른 팀 ID는 이전 화면 그대로이고 추가 요청도 없다. 허용 팀 상수는 `lib/ai/allowed-entry.ts`(import 없는 작은 파일, 브라우저 번들용)로 옮겼고 `lib/ai/config.ts`가 다시 내보낸다. 넓히는 것은 #47(회원 전용) 뒤.
- 규칙 기반 패널은 AI 설정과 무관하게 항상 보인다(`/api/entry-recommend`, 응답에 `playerInfo`로 시나리오 선수의 이름·팀·포지션·현재가를 붙임). AI 패널은 화면이 열릴 때 `GET /api/entry-ai`로 상태만 읽고, 사람이 버튼을 누를 때만 POST한다. `disabled`·`not_allowed`면 AI 패널을 그리지 않는다.
- 파일: `components/recommend-panel.tsx`(규칙 기반), `recommend-transfers.tsx`, `ai-opinion-panel.tsx`(상태별 화면·5초 폴링·20분 포기·탭 숨김 시 중지), `recommend-parts.tsx`, 문구 `lib/recommend-text.ts`. AI 문장은 일반 텍스트로만 그린다.

## 2026-11-22 추천 기록과 80% 알림 (#43 5단계)
- **새 마이그레이션 없음**: 0002의 `ai_recommendation_log` 표만 쓴다(구조가 모자라는 값은 jsonb 안에: `rules_summary`, `actual_result`). 0002가 운영에 적용돼 있어야 기록이 쌓인다. 표가 없거나 설정(`SUPABASE_URL`·`SUPABASE_SERVICE_ROLE_KEY`)이 없으면 조용히 건너뛴다(추천 응답은 그대로). `AI_RECOMMEND_ENABLED`와는 무관(유료 호출이 아님).
- **쓰기**: 허용 팀의 `/api/entry-recommend`(기본 3주 horizon만)가 응답을 준 뒤 기다리지 않고 요약을 upsert(`lib/ai/rec-log.ts#recordRecommendation`). 같은 (팀, GW)는 프로세스 안에서 10분에 한 번, 대상 GW 마감 전까지만 마지막 방문 값으로 덮어쓴다(마감 시각은 xP 표의 `targetDeadline`). 그 GW·ko 또는 en의 완료된 AI 저장본이 있으면 `rules_summary.ai`에 캡틴·선발 선택(L1~L3)·이적 1순위를 같이 담는다(다음 방문 때 반영; AI 저장 시점에는 쓰지 않는다).
- **채우기**: `GET /api/entry-recommend-log?entryId=`(허용 팀만, 아니면 `{entries:[]}` 200, 기존 IP 제한). 끝난 GW(`bootstrap.events[].finished`)인데 `actual_result`가 null인 행을 요청당 최대 2개 GW까지 채운다(GW당 `getEventLive` 1회 + `getEntryPicks` 1회, 채운 뒤에는 다시 부르지 않음). 점수는 선수 점수 기준(주장 2배·자동 교체 제외). 최적 선발은 `lib/xp/lineup.ts#buildLineups`를 실제 점수로 재사용. 칩 시나리오의 실제 순이익은 계산하지 않는다.
- **화면**: 추천 패널 맨 아래 접힌 "지난 추천 기록(참고)"(`components/recommend-log-panel.tsx`). 열 때만 요청한다. 표본이 작아 통계적 결론은 약하다는 문구가 맨 위에 항상 있다(계획서 6-2).
- **80% 알림**: `GET /api/entry-ai` 응답에 `budgetNotice: "near_limit" | null`(이번 UTC 달 `ai_usage` 합 ÷ `MONTHLY_CAP_USD` ≥ 0.8). 금액·토큰은 싣지 않는다. 합은 `ai_usage`를 읽는 쿼리로 구한다(새 SQL 함수 없음). 읽기 실패는 null. 서버 로그에 `[entry-ai] budget_80` 한 줄(프로세스당 하루 1회). 100%는 기존대로 DB 함수가 막는다.

## 2026-11-22 회원 팀 등록·본인 팀 분석 (#47)
- **본인 팀 가드**(`lib/journal/own-team.ts#checkOwnTeam`): 세션 쿠키의 회원과 `journal_profiles.fpl_team_id`를 요청한 `entryId`와 대조(캐시 없음). 비로그인 401 `login_required`, 다른 팀 403 `not_your_team`, 스토어 미설정·읽기 실패 503. 적용: `/api/entry-recommend`(IP 제한·FPL 호출보다 앞), `/api/entry-recommend-log`(허용 팀 판정보다 앞), `/api/entry-ai` GET·POST(`disabled`·`not_allowed` 무료 판정 다음, DB·유료 경로 앞. POST는 `isSameOrigin`도 요구). `/api/entry-squad`(읽기 화면)는 공개 그대로. 유료 AI·추천 기록 저장은 여전히 허용 팀(`ALLOWED_ENTRY_IDS`)만.
- **새 API 3개**: `GET /api/journal/me`(`{member:false}` 또는 `{member:true, teamId, nextTeamChangeAt}`, `private, no-store`, 이메일 없음), `GET /api/journal/team-lookup?teamId=`(로그인 불필요, FPL 공개 데이터로 `{teamId, teamName, managerName}`; `checkEntryRequest` IP 제한 + `lib/journal/team-lookup.ts`의 5분 메모리 캐시; 404 `team_not_found`·장애 `fpl_unavailable`), `POST /api/journal/team {teamId}`(`isSameOrigin`+로그인; `ok`·`same_team` 400·`team_taken` 409·`team_not_found` 404·`fpl_unavailable` 503·`too_soon` 429 + `nextTeamChangeAt`·`change_failed` 502). `GET /api/journal/entries`에도 `nextTeamChangeAt`을 더했다.
- **30일 제한**: `TEAM_CHANGE_COOLDOWN_DAYS = 30`(`lib/journal/types.ts`). 팀을 자유롭게 바꾸면 남의 팀을 차례로 분석하는 통로가 되기 때문. 첫 변경(`team_changed_at` null)은 바로 가능. 서비스(`changeMemberTeam`)가 같은 팀·대기 기간을 FPL 호출 전에 거르고, DB 함수가 행 잠금 아래에서 다시 판정한다.
- **마이그레이션 0003**(`db/migrations/0003_journal_team_change.sql`, 롤백 `.rollback.sql`, 추가형): `journal_profiles.team_changed_at timestamptz`(null 허용) + `journal_change_team(p_user, p_team, p_cooldown_days)`(security definer, service_role만 실행). 한 트랜잭션: 행 잠금 → 같은 팀 → 대기 기간 → 갱신 → 그 회원의 `journal_snapshots` 삭제(`journal_notes`는 남김). 프로필이 없으면 새로 만든다. **운영 DB에 먼저 적용(관제 창, L2)한 뒤 병합**: 새 코드가 `team_changed_at` 열을 읽는다.
- 화면: 가입 양식과 일지의 '등록한 팀 · 팀 바꾸기'는 `components/team-picker.tsx`(조회 → 팀 이름·매니저 → '이 팀이 맞습니다' 체크)를 같이 쓴다(`components/team-row.tsx`). `/team`은 회원의 등록 팀이 있으면 그 팀으로, 없으면 브라우저 기억(`team-entry-page.tsx`). `/team/[id]` 추천 패널은 `/api/journal/me`의 `teamId === entryId`일 때만(`squad-page.tsx`), 아니면 한 줄 안내(`member-only-notice.tsx`); 패널이 401·403을 받아도 같은 안내로 바뀐다. AI 의견·추천 기록 구역은 허용 팀일 때만 그린다.

## 2026-11-23 '전체 AI 이용' (#85)
- 'AI 의견'의 '다시 분석' 앞 체크박스(기본 꺼짐, 브라우저에 기억 `fpl-ai-full`). 켜고 분석하면 AI가 선발 11·벤치 순서·캡틴/부캡틴·포메이션·이적(0~2명 또는 칩)을 직접 고르고 선수마다 근거를 낸다. `GET/POST /api/entry-ai`에 `mode=full`.
- **서버 규칙 검증**(`lib/ai/full-schema.ts#validateFullOutput`): 칩 사용 가능, 칩 없으면 이적 2명 이하, 15명 구성 2/5/5/3, 같은 팀 3명, 예산(판매가 합 + 은행 ≥ 영입 현재가 합), 선발 11·포메이션, 벤치 첫째 GK, 캡틴·부캡틴 선발, 선수별 근거 완비, 문장 규칙(숫자·마크업 금지). 감점은 서버가 계산. 위반이면 1회 재요청, 또 위반이면 규칙 엔진 최선안으로 대체하고 '검증 실패' 표시.
- **비용**: 별도 예약 `maxCostFullCallUsd` = $1.088(입력 36,000 + 출력 20,000 토큰 상한, `lib/ai/config.ts`). 일 $5·월 $40·일 10회 상한은 그대로. 예상 실비용 1회 약 $0.3(입력 약 15k·출력 약 4k 토큰 가정; 실제 호출 전이라 확인 못 함). 월 80% 근처면 체크박스 비활성.
- **저장**: 새 마이그레이션 없음. 같은 `ai_recommendations` 표·키에 `basis.mode="full"`로 저장(`lib/ai/store.ts#jobModeOf`). 키당 진행 1개·세대 3회·수동 하루 1회를 두 모드가 같이 쓴다. 같은 입력 해시의 검증된 답이 있으면 '다시 분석'도 호출 없이 재사용.
- **전체 AI 한도**: 월 사용액이 80%를 넘으면 화면의 체크박스가 꺼지고, 서버도 `mode=full` 새 호출을 `limit/month`로 거절한다(`lib/ai/full-flow.ts`, 저장된 답 읽기는 그대로).
- **되돌릴 때**: 이 PR을 revert하면 옛 `latest()`가 `basis.mode="full"` 행을 순위 답으로 읽어 그 GW·언어의 AI 의견 화면이 깨질 수 있다. 되돌리기 전에 해당 GW의 full 행을 지우거나 다음 GW까지 기다린다(운영 DB 쓰기는 관제 창, L2).
