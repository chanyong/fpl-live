import { LeagueEntryHint, PublicDataNotice, PublicPageFrame } from "@/components/public-page-frame";
import { TeamsPanel } from "@/components/teams-panel";
import { getPublicFootball } from "@/lib/public-data";
import { publicPageMetadata } from "@/lib/public-pages";

export const metadata = publicPageMetadata("premier-league");

// Drawn on the server for every request from a 60-second memo of FPL's data (lib/public-data), never at build time.
export const dynamic = "force-dynamic";

export default async function PremierLeagueRoute() {
  const data = await getPublicFootball();

  return (
    <PublicPageFrame
      title={{ ko: "프리미어리그 순위표", en: "Premier League table" }}
      subtitle={{
        ko: "팀별 향후 일정 난이도(FDR)와 20개 팀의 현재 승점·득실차·최근 5경기·다음 상대. 진행 중인 경기는 현재 스코어를 반영합니다.",
        en: "Each club's upcoming fixture difficulty (FDR), plus points, goal difference, last five results and next opponent for all 20 clubs. Live matches count at the current score."
      }}
    >
      {data ? <TeamsPanel outlook={data.teamOutlook} table={data.table} /> : <PublicDataNotice />}
      <LeagueEntryHint />
    </PublicPageFrame>
  );
}
