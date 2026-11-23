import { FixturesPanel } from "@/components/fixtures-panel";
import { PublicGwNav } from "@/components/public-gw-nav";
import { LeagueEntryHint, PublicDataNotice, PublicPageFrame } from "@/components/public-page-frame";
import { getPublicFootball } from "@/lib/public-data";
import { parsePublicGw } from "@/lib/public-football";
import { publicPageMetadata } from "@/lib/public-pages";

export const metadata = publicPageMetadata("fixtures");

// Drawn on the server for every request from a 60-second memo of FPL's data (lib/public-data), never at build time.
export const dynamic = "force-dynamic";

/** Kickoffs in Korean time: the page is drawn on the server, and a viewer-zone clock would differ from the browser's. */
const KICKOFF_ZONE = "Asia/Seoul";

export default async function FixturesRoute({ searchParams }: { searchParams?: Promise<{ gw?: string | string[] }> }) {
  const query = searchParams ? await searchParams : {};
  const data = await getPublicFootball(parsePublicGw(query.gw));

  return (
    <PublicPageFrame
      title={{ ko: "프리미어리그 경기 일정", en: "Premier League fixtures" }}
      subtitle={{
        ko: "게임위크별 경기 일정·결과와 보너스 점수 선수. 지난·다음 게임위크로 넘겨 볼 수 있습니다.",
        en: "Fixtures, results and bonus points for each gameweek. Step to the previous or next gameweek."
      }}
    >
      {data ? (
        <FixturesPanel
          fixtures={data.fixtures}
          currentGw={data.gw}
          timeZone={KICKOFF_ZONE}
          headerExtra={<PublicGwNav gw={data.gw} firstGw={data.firstGw} lastGw={data.lastGw} currentGw={data.currentGw} />}
        />
      ) : (
        <PublicDataNotice />
      )}
      <LeagueEntryHint />
    </PublicPageFrame>
  );
}
