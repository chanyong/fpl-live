/** Meta description for a league page, kept within 70–120 characters whatever the league name. */
export function leagueDescription(name: string, gw: number | null) {
  const short = name.length > 30 ? `${name.slice(0, 29)}…` : name;
  const gwText = gw ? `게임위크 ${gw} ` : "";
  const text = `${short} FPL 미니리그의 ${gwText}실시간 순위와 잠정 점수, BPS 보너스 예상, 라이벌과의 점수 차를 로그인 없이 확인하세요.`;
  const padded = text.length < 70 ? `${text} 공식 FPL 데이터로 30초마다 갱신됩니다.` : text;
  return padded.length > 120 ? `${padded.slice(0, 119)}…` : padded;
}

export function leagueTitle(name: string, gw: number | null) {
  return gw ? `${name} 실시간 순위 · GW ${gw} | FPL Live` : `${name} 실시간 순위 | FPL Live`;
}

/** Which dashboard screen a league page shows; mirrors lib/league-views (issue #33). */
export type LeagueMetaView = "fixtures" | "table" | "rank-change" | "teams" | "players";

const VIEW_META: Record<Exclude<LeagueMetaView, "fixtures">, { label: string; body: string }> = {
  table: {
    label: "주간 순위표",
    body: "의 이번 주 순위표와 잠정 점수, 순위 변동, 라이벌과의 점수 차를 로그인 없이 확인하세요."
  },
  "rank-change": {
    label: "순위 추이",
    body: "의 게임위크별 순위 추이를 그래프로 확인하세요. 누가 치고 올라오는지 로그인 없이 바로 볼 수 있습니다."
  },
  teams: {
    label: "팀별 일정·프리미어리그 순위표",
    body: "에서 볼 프리미어리그 팀별 앞으로의 일정 난이도와 현재 순위표를 로그인 없이 확인하세요."
  },
  players: {
    label: "선수 통계·추이",
    body: "에서 많이 보유한 선수들의 점수와 폼, 가격 추이를 로그인 없이 확인하세요. 공식 FPL 데이터를 씁니다."
  }
};

/** Page title for one dashboard screen. The default screen keeps the league title. */
export function leagueViewTitle(name: string, gw: number | null, view: LeagueMetaView) {
  if (view === "fixtures") return leagueTitle(name, gw);
  const { label } = VIEW_META[view];
  return gw ? `${name} ${label} · GW ${gw} | FPL Live` : `${name} ${label} | FPL Live`;
}

/** Meta description for one dashboard screen, 70–120 characters whatever the league name. */
export function leagueViewDescription(name: string, gw: number | null, view: LeagueMetaView) {
  if (view === "fixtures") return leagueDescription(name, gw);
  const short = name.length > 30 ? `${name.slice(0, 29)}…` : name;
  const text = `${short} FPL 미니리그${VIEW_META[view].body}`;
  const padded = text.length < 70 ? `${text} 30초마다 갱신됩니다.` : text;
  return padded.length > 120 ? `${padded.slice(0, 119)}…` : padded;
}
