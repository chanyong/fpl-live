# FPL Live 홍보 실행 가이드

링크는 항상 채널 꼬리표를 붙여 공유한다: `https://fpl-live-production-34f4.up.railway.app/?ref=reddit` (`x`, `naver`, `dc`, `discord` 등).

## 게시글 초안 (영어 · Reddit r/FantasyPL, X)

**Title:** I built a free live mini-league tracker (no login) with price change predictions

I got tired of refreshing the FPL app during matches, so I built FPL Live. Enter a classic league ID and you get:
- live provisional points and rank swings during the gameweek
- rank history across the season
- transfer market + price change predictions (filter by progress, projection, outlook)
- English / Korean

It's free, no login, and unofficial. Feedback and bug reports very welcome.
Price predictions without a league ID: /price-changes

> Reddit는 자기 홍보 규칙이 있다. 게시 전에 사이드바 규칙과 주간 스레드를 확인하고, 가능하면 "Show & tell" 류 스레드에 올린다.

**X (짧은 버전):**
Built a free live mini-league tracker for #FPL: rank swings during matches, price change predictions with filters, no login. Try it with your league ID 👇 [link] #FPLCommunity

## 한국어 초안 (네이버 카페 · 디시 · 커뮤니티)

제목: FPL 미니리그 실시간 순위 + 가격 변동 예측 사이트 만들었습니다 (무료, 로그인 없음)

경기 중에 FPL 앱을 계속 새로고침하는 게 번거로워서 만들었습니다. 리그 ID만 넣으면 실시간 잠정 점수와 순위 변동, 시즌 순위 추이, 이적 시장/가격 변동 예측을 볼 수 있어요. 한국어/영어 지원, 비공식 팬 서비스입니다. 불편한 점은 댓글 주세요.

## 주간 루틴

| 시점 | 할 일 |
|---|---|
| 마감 24시간 전 | 가격 변동 유력 Top 5 스크린샷 → X, 커뮤니티 |
| 경기 중 | 가장 큰 순위 변동 스크린샷 |
| 게임위크 종료 후 | 주간 최고 득점 매니저 |

## 측정

Plausible 또는 GA4 연결 후 `?ref=` 별 방문자, 홈 → 리그 전환율, 7일 재방문율을 본다.
