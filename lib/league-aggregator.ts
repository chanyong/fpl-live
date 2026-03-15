import {
  getAllStandings,
  getBootstrapStatic,
  getEntry,
  getEntryPicks,
  getEventLive,
  getFixtures
} from "@/lib/fpl-client";
import {
  calculateLiveScore,
  computePlayersPlayed,
  computeProjectedRanks,
  splitSquad,
  type ScoringContext
} from "@/lib/scoring";
import type {
  CaptainStat,
  Chip,
  ElementSummary,
  EntryHistory,
  FixtureSummary,
  LeagueLiveResponse,
  LeagueRow,
  Pick,
  TeamSummary
} from "@/lib/types";

type LeagueLiveArgs = {
  leagueId: number;
  gw: string;
  forceRefresh?: boolean;
};

function getCurrentGw(events: Array<{ id: number; is_current: boolean; finished: boolean }>) {
  const current = events.find((event) => event.is_current);
  if (current) {
    return current.id;
  }

  return events.find((event) => !event.finished)?.id ?? events[events.length - 1]?.id ?? 1;
}

function getPlayerPhoto(photo: string | undefined) {
  return photo
    ? `https://resources.premierleague.com/premierleague/photos/players/110x140/p${photo.replace(".jpg", "")}.png`
    : null;
}

function toScoringContext(args: {
  elements: ElementSummary[];
  teams: TeamSummary[];
  liveElements: Array<{ id: number; stats: { minutes: number; total_points: number } }>;
  fixtures: Array<{
    id: number;
    event: number | null;
    team_h: number;
    team_a: number;
    started: boolean | null;
    finished: boolean;
    finished_provisional: boolean;
  }>;
}): ScoringContext {
  return {
    elementsById: new Map(args.elements.map((element) => [element.id, element])),
    teamsById: new Map(args.teams.map((team) => [team.id, team])),
    liveByElementId: new Map(
      args.liveElements.map((element) => [
        element.id,
        {
          minutes: element.stats.minutes,
          totalPoints: element.stats.total_points
        }
      ])
    ),
    fixturesByTeamId: args.fixtures.reduce<Map<number, FixtureSummary[]>>((map, fixture) => {
      const fixtureSummary: FixtureSummary = {
        id: fixture.id,
        event: fixture.event ?? 0,
        teamH: fixture.team_h,
        teamA: fixture.team_a,
        started: Boolean(fixture.started),
        finished: fixture.finished,
        finishedProvisional: fixture.finished_provisional
      };

      const home = map.get(fixture.team_h) ?? [];
      home.push(fixtureSummary);
      map.set(fixture.team_h, home);

      const away = map.get(fixture.team_a) ?? [];
      away.push(fixtureSummary);
      map.set(fixture.team_a, away);

      return map;
    }, new Map())
  };
}

function buildCaptainStats(rows: LeagueRow[], elementsById: Map<number, ElementSummary>): CaptainStat[] {
  const counts = new Map<number, number>();

  for (const row of rows) {
    const captain = row.squad.starters.find((player) => player.isCaptain);
    if (!captain) {
      continue;
    }

    counts.set(captain.elementId, (counts.get(captain.elementId) ?? 0) + 1);
  }

  const totalManagers = rows.length || 1;

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([elementId, managerCount]) => {
      const element = elementsById.get(elementId);
      return {
        elementId,
        webName: element?.webName ?? "Unknown",
        photoUrl: getPlayerPhoto(element?.photo),
        managerCount,
        percentage: Number(((managerCount / totalManagers) * 100).toFixed(1))
      };
    });
}

function buildRow(args: {
  standing: {
    entry: number;
    entry_name: string;
    player_name: string;
    rank: number;
    total: number;
  };
  picks: {
    picks: Array<{
      element: number;
      position: number;
      multiplier: number;
      is_captain: boolean;
      is_vice_captain: boolean;
    }>;
    active_chip: Chip;
    automatic_subs: Array<{
      element_in: number;
      element_out: number;
      entry: number;
      event: number;
    }>;
    entry_history: EntryHistory;
  };
  entry: { id: number; summary_overall_points: number };
  context: ScoringContext;
}): LeagueRow {
  const picks: Pick[] = args.picks.picks.map((pick) => ({
    element: pick.element,
    position: pick.position,
    multiplier: pick.multiplier,
    isCaptain: pick.is_captain,
    isViceCaptain: pick.is_vice_captain
  }));

  const captainPick = picks.find((pick) => pick.isCaptain);
  const captainName = captainPick
    ? args.context.elementsById.get(captainPick.element)?.webName ?? "Unknown"
    : "Unknown";

  const liveScore = calculateLiveScore({
    picks,
    automaticSubs: args.picks.automatic_subs.map((item) => ({
      elementIn: item.element_in,
      elementOut: item.element_out
    })),
    chip: args.picks.active_chip,
    transferCost: args.picks.entry_history.event_transfers_cost,
    officialTotalBeforeLive: args.standing.total - args.picks.entry_history.points,
    context: args.context
  });

  return {
    entryId: args.standing.entry,
    rank: args.standing.rank,
    projectedRank: args.standing.rank,
    teamName: args.standing.entry_name,
    managerName: args.standing.player_name,
    captainName,
    chip: args.picks.active_chip,
    playersPlayed: computePlayersPlayed(picks, args.context),
    gwPoints: args.picks.entry_history.points,
    totalPoints: args.standing.total,
    projectedTotalPoints: liveScore.totalPoints,
    squad: splitSquad(
      picks,
      args.picks.active_chip,
      args.context,
      args.picks.automatic_subs.map((item) => ({
        elementIn: item.element_in,
        elementOut: item.element_out
      }))
    ),
    calculationStatus: "ok",
    provisional: liveScore.provisional
  };
}

export async function getLeagueLivePayload({
  leagueId,
  gw,
  forceRefresh
}: LeagueLiveArgs): Promise<LeagueLiveResponse> {
  const [bootstrap, standings, fixtures] = await Promise.all([
    getBootstrapStatic({ forceRefresh }),
    getAllStandings(leagueId, { forceRefresh }),
    getFixtures({ forceRefresh })
  ]);

  const currentGw = gw === "current" ? getCurrentGw(bootstrap.events) : Number(gw);
  const live = await getEventLive(currentGw, { forceRefresh });
  const elements = bootstrap.elements.map((element) => ({
    id: element.id,
    webName: element.web_name,
    teamId: element.team,
    elementType: element.element_type,
    photo: element.photo
  }));
  const context = toScoringContext({
    elements,
    teams: bootstrap.teams.map((team) => ({
      id: team.id,
      shortName: team.short_name
    })),
    liveElements: live.elements,
    fixtures: fixtures.filter((fixture) => fixture.event === currentGw)
  });

  const rowResults = await Promise.allSettled(
    standings.results.map(async (standing) => {
      const [entry, picks] = await Promise.all([
        getEntry(standing.entry, { forceRefresh }),
        getEntryPicks(standing.entry, currentGw, { forceRefresh })
      ]);

      return buildRow({
        standing,
        entry,
        picks,
        context
      });
    })
  );

  const errors: string[] = [];
  const rows: LeagueRow[] = rowResults.flatMap((result, index) => {
    if (result.status === "fulfilled") {
      return result.value;
    }

    const standing = standings.results[index];
    errors.push(
      `${standing.player_name}: ${result.reason instanceof Error ? result.reason.message : "Unknown failure"}`
    );

    return [
      {
        entryId: standing.entry,
        rank: standing.rank,
        projectedRank: standing.rank,
        teamName: standing.entry_name,
        managerName: standing.player_name,
        captainName: "-",
        chip: null,
        playersPlayed: 0,
        gwPoints: 0,
        totalPoints: standing.total,
        projectedTotalPoints: standing.total,
        squad: {
          starters: [],
          bench: []
        },
        calculationStatus: "partial" as const,
        provisional: true
      }
    ];
  });

  return {
    league: {
      id: standings.league.id,
      name: standings.league.name,
      currentGw,
      lastUpdated: new Date().toISOString(),
      isProvisional: true
    },
    captainStats: buildCaptainStats(rows, context.elementsById),
    rows: computeProjectedRanks(rows),
    errors
  };
}


