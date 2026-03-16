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
  LeagueFixture,
  LeagueFixtureStat,
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

type FixtureWithStats = {
  id: number;
  event: number | null;
  kickoff_time: string | null;
  team_h: number;
  team_a: number;
  team_h_score: number | null;
  team_a_score: number | null;
  started: boolean | null;
  finished: boolean;
  finished_provisional: boolean;
  stats: Array<{
    identifier: string;
    h: Array<{ value: number; element: number }>;
    a: Array<{ value: number; element: number }>;
  }>;
};

const STAT_LABELS: Record<string, string> = {
  goals_scored: "Goals scored",
  assists: "Assists",
  own_goals: "Own goals",
  penalties_saved: "Penalties saved",
  penalties_missed: "Penalties missed",
  yellow_cards: "Yellow cards",
  red_cards: "Red cards",
  saves: "Saves",
  bonus: "Bonus",
  bps: "Bonus Points System"
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

function assignProvisionalBonus(values: Array<{ value: number; element: number }>) {
  const sorted = [...values].sort((left, right) => right.value - left.value);
  if (sorted.length === 0) {
    return [] as Array<{ element: number; bonus: number }>;
  }

  const top = sorted[0]?.value;
  const firstGroup = sorted.filter((item) => item.value === top);
  if (firstGroup.length >= 3) {
    return firstGroup.map((item) => ({ element: item.element, bonus: 3 }));
  }

  if (firstGroup.length === 2) {
    const next = sorted.find((item) => item.value < top);
    return [
      ...firstGroup.map((item) => ({ element: item.element, bonus: 3 })),
      ...(next ? [{ element: next.element, bonus: 1 }] : [])
    ];
  }

  const secondValue = sorted.find((item) => item.value < top)?.value;
  if (secondValue === undefined) {
    return [{ element: sorted[0].element, bonus: 3 }];
  }

  const secondGroup = sorted.filter((item) => item.value === secondValue);
  if (secondGroup.length >= 2) {
    return [
      { element: sorted[0].element, bonus: 3 },
      ...secondGroup.map((item) => ({ element: item.element, bonus: 2 }))
    ];
  }

  const third = sorted.find((item) => item.value < secondValue);
  return [
    { element: sorted[0].element, bonus: 3 },
    { element: secondGroup[0].element, bonus: 2 },
    ...(third ? [{ element: third.element, bonus: 1 }] : [])
  ];
}

function buildProvisionalBonusByElement(fixtures: FixtureWithStats[]) {
  const bonusMap = new Map<number, number>();

  for (const fixture of fixtures) {
    if (!fixture.started || fixture.finished_provisional) {
      continue;
    }

    const bpsStat = fixture.stats.find((stat) => stat.identifier === "bps");
    if (!bpsStat) {
      continue;
    }

    const provisional = assignProvisionalBonus([...bpsStat.h, ...bpsStat.a]);
    for (const item of provisional) {
      bonusMap.set(item.element, (bonusMap.get(item.element) ?? 0) + item.bonus);
    }
  }

  return bonusMap;
}

function toScoringContext(args: {
  elements: ElementSummary[];
  teams: TeamSummary[];
  liveElements: Array<{ id: number; stats: { minutes: number; total_points: number; bonus: number; bps: number } }>;
  fixtures: FixtureWithStats[];
}): ScoringContext {
  const provisionalBonusByElement = buildProvisionalBonusByElement(args.fixtures);

  return {
    elementsById: new Map(args.elements.map((element) => [element.id, element])),
    teamsById: new Map(args.teams.map((team) => [team.id, team])),
    liveByElementId: new Map(
      args.liveElements.map((element) => [
        element.id,
        {
          minutes: element.stats.minutes,
          totalPoints: element.stats.total_points + (provisionalBonusByElement.get(element.id) ?? 0)
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

function buildFixtureStats(
  fixture: FixtureWithStats,
  elementsById: Map<number, ElementSummary>,
  teamsById: Map<number, TeamSummary>
): LeagueFixtureStat[] {
  return fixture.stats
    .map((stat) => ({
      key: stat.identifier,
      label: STAT_LABELS[stat.identifier] ?? stat.identifier.replace(/_/g, " "),
      home: stat.h
        .map((item) => {
          const element = elementsById.get(item.element);
          const team = element ? teamsById.get(element.teamId) : undefined;
          return {
            elementId: item.element,
            playerName: element?.webName ?? `Player ${item.element}`,
            teamShortName: team?.shortName ?? "-",
            value: item.value
          };
        })
        .sort((left, right) => right.value - left.value),
      away: stat.a
        .map((item) => {
          const element = elementsById.get(item.element);
          const team = element ? teamsById.get(element.teamId) : undefined;
          return {
            elementId: item.element,
            playerName: element?.webName ?? `Player ${item.element}`,
            teamShortName: team?.shortName ?? "-",
            value: item.value
          };
        })
        .sort((left, right) => right.value - left.value)
    }))
    .filter((stat) => stat.home.length > 0 || stat.away.length > 0);
}

function buildFixturesPayload(
  fixtures: FixtureWithStats[],
  teamsById: Map<number, TeamSummary>,
  elementsById: Map<number, ElementSummary>
): LeagueFixture[] {
  return fixtures
    .map((fixture) => {
      const homeTeam = teamsById.get(fixture.team_h);
      const awayTeam = teamsById.get(fixture.team_a);

      return {
        id: fixture.id,
        kickoffTime: fixture.kickoff_time,
        homeTeam: homeTeam?.name ?? "Home",
        awayTeam: awayTeam?.name ?? "Away",
        homeShortName: homeTeam?.shortName ?? "-",
        awayShortName: awayTeam?.shortName ?? "-",
        homeScore: fixture.team_h_score,
        awayScore: fixture.team_a_score,
        started: Boolean(fixture.started),
        finished: fixture.finished,
        finishedProvisional: fixture.finished_provisional,
        stats: buildFixtureStats(fixture, elementsById, teamsById)
      };
    })
    .sort((left, right) => {
      if (left.kickoffTime && right.kickoffTime) {
        return left.kickoffTime.localeCompare(right.kickoffTime);
      }

      return left.id - right.id;
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

  const automaticSubs = args.picks.automatic_subs.map((item) => ({
    elementIn: item.element_in,
    elementOut: item.element_out
  }));

  const liveScore = calculateLiveScore({
    picks,
    automaticSubs,
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
    playersPlayed: computePlayersPlayed({
      picks,
      automaticSubs,
      chip: args.picks.active_chip,
      context: args.context
    }),
    lineupPoints: liveScore.lineupPoints,
    transferCost: args.picks.entry_history.event_transfers_cost,
    gwPoints: liveScore.gwPoints,
    totalPoints: liveScore.totalPoints,
    projectedTotalPoints: liveScore.totalPoints,
    squad: splitSquad(picks, args.picks.active_chip, args.context, automaticSubs),
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
  const currentGwFixtures = fixtures.filter((fixture) => fixture.event === currentGw);
  const live = await getEventLive(currentGw, { forceRefresh });
  const elements = bootstrap.elements.map((element) => ({
    id: element.id,
    webName: element.web_name,
    teamId: element.team,
    elementType: element.element_type,
    photo: element.photo
  }));
  const teams = bootstrap.teams.map((team) => ({
    id: team.id,
    name: team.name,
    shortName: team.short_name
  }));
  const teamsById = new Map(teams.map((team) => [team.id, team]));
  const context = toScoringContext({
    elements,
    teams,
    liveElements: live.elements,
    fixtures: currentGwFixtures
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
        lineupPoints: 0,
        transferCost: 0,
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
    fixtures: buildFixturesPayload(currentGwFixtures, teamsById, context.elementsById),
    rows: computeProjectedRanks(rows),
    errors
  };
}