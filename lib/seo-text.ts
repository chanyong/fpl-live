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
