import { OG_SIZE, renderOgCard } from "@/lib/og-card";
import { getLeagueMeta } from "@/lib/league-meta";
import { parseLeagueId } from "@/lib/request-params";

export const alt = "FPL Live 미니리그 실시간 순위";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function LeagueOgImage({ params }: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await params;
  const parsed = parseLeagueId(leagueId);
  let name = "FPL 미니리그";
  let gw: number | null = null;

  if (!("error" in parsed)) {
    try {
      const meta = await getLeagueMeta(parsed.leagueId);
      name = meta.name;
      gw = meta.gw;
    } catch {
      name = `리그 ${parsed.leagueId}`;
    }
  }

  const title = name.length > 40 ? `${name.slice(0, 39)}…` : name;
  return renderOgCard({
    eyebrow: "FPL Live · 미니리그 라이브",
    title,
    subtitle: gw ? `게임위크 ${gw} 실시간 순위 · 잠정 점수 · 라이벌 점수 차` : "실시간 순위 · 잠정 점수 · 라이벌 점수 차",
    chip: "링크를 열면 로그인 없이 바로 보기"
  }, {
    eyebrow: "FPL Live · mini-league live",
    // Without the Korean font, non-Latin names would render as boxes.
    title: /^[\x20-\x7E]+$/.test(title) ? title : "FPL mini-league",
    subtitle: gw ? `Gameweek ${gw} live standings · provisional points` : "Live standings · provisional points",
    chip: "Open the link — no login needed"
  });
}
