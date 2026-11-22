import { LeagueEntryHint, PublicDataNotice, PublicPageFrame } from "@/components/public-page-frame";
import { PlayerTrendsPanel } from "@/components/player-trends-panel";
import { getPublicPlayers } from "@/lib/public-data";
import { publicPageMetadata } from "@/lib/public-pages";

export const metadata = publicPageMetadata("players");

// Drawn on the server for every request from a 60-second memo of FPL's data (lib/public-data), never at build time.
export const dynamic = "force-dynamic";

export default async function PlayersRoute() {
  const data = await getPublicPlayers();

  return (
    <PublicPageFrame
      title={{ ko: "FPL 선수 통계", en: "FPL player stats" }}
      subtitle={{
        ko: "시즌 점수와 폼, 이번 주 영입·방출 추이, 소유율이 낮은 차별화 후보를 포지션별로.",
        en: "Season points and form, this week's transfers in and out, and low-owned differentials, by position."
      }}
    >
      {data ? (
        <PlayerTrendsPanel
          scope="public"
          data={{
            players: data.players,
            fdr: data.fdr,
            managers: [],
            leaguePlayers: [],
            league: { currentGw: data.currentGw, nextGw: data.nextGw }
          }}
        />
      ) : (
        <PublicDataNotice />
      )}
      <LeagueEntryHint />
    </PublicPageFrame>
  );
}
