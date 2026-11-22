import { LeagueEntryHint, PublicDataNotice, PublicPageFrame } from "@/components/public-page-frame";
import { PublicFixtureList } from "@/components/public-fixture-list";
import { TeamFixtureTable } from "@/components/team-fixture-table";
import { getPublicFootball } from "@/lib/public-data";
import { publicPageMetadata } from "@/lib/public-pages";

export const metadata = publicPageMetadata("fixtures");

// Drawn on the server for every request from a 60-second memo of FPL's data (lib/public-data), never at build time.
export const dynamic = "force-dynamic";

export default async function FixturesRoute() {
  const data = await getPublicFootball();

  return (
    <PublicPageFrame
      title={{ ko: "프리미어리그 경기 일정", en: "Premier League fixtures" }}
      subtitle={{
        ko: "이번 게임위크와 다음 두 게임위크의 경기 일정·결과, 그리고 팀별 향후 일정 난이도.",
        en: "Fixtures and results for this gameweek and the next two, plus each club's upcoming fixture difficulty."
      }}
    >
      {data ? (
        <>
          {data.weeks.map((week) => (
            <PublicFixtureList key={week.gw} week={week} currentGw={data.currentGw} />
          ))}
          <TeamFixtureTable data={data.teamOutlook} />
        </>
      ) : (
        <PublicDataNotice />
      )}
      <LeagueEntryHint />
    </PublicPageFrame>
  );
}
