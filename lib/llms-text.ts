import { CONTACT_EMAIL, siteUrl } from "@/lib/site";

/** Plain-text summary for AI search and assistants (issue #1, SITE_RULES 1-7). */
export function llmsText(base: string = siteUrl()): string {
  return [
    "# FPL Live",
    "",
    "> FPL(Fantasy Premier League, 판타지 프리미어리그) 클래식 미니리그의 잠정 점수·실시간 순위, BPS 보너스 예상, 라이벌 점수 차, 선수 가격 변동 예측을 로그인 없이 무료로 보여 주는 한국어(영어 전환 가능) 대시보드입니다.",
    "",
    "## 데이터",
    "- 출처: 공식 FPL 공개 API(fantasy.premierleague.com)만 씁니다. 로그인·개인정보 수집은 없습니다.",
    "- 갱신: 리그 순위·잠정 점수는 경기 중 30초마다, 가격 변동 예측은 1분마다 다시 받습니다.",
    "- 잠정 점수·보너스·자동 교체와 가격 변동 예측은 추정값이라 공식 확정값과 다를 수 있습니다.",
    "",
    "## 주요 페이지",
    `- [홈](${base}/): 미니리그 ID를 넣어 리그 대시보드로 이동`,
    `- 리그 대시보드: ${base}/league/{리그ID} 형식. 실시간 순위·경기별 보유 선수·순위 추이·선수 표 (리그 ID는 FPL 공식 사이트의 리그 주소에 있는 숫자)`,
    `- [가격 변동 예측](${base}/price-changes): 오늘 밤 오를·내릴 가능성이 큰 선수와 최근 실제 변동`,
    `- [자주 묻는 질문](${base}/faq)`,
    `- [개인정보처리방침](${base}/privacy)`,
    `- [이용약관](${base}/terms)`,
    "",
    "## 연락",
    `- ${CONTACT_EMAIL}`,
    ""
  ].join("\n");
}
