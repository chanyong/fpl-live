export type FplPosition = "GKP" | "DEF" | "MID" | "FWD";

export type PlayerStatus = "played" | "live" | "not_played";

export type Chip =
  | "3xc"
  | "bboost"
  | "freehit"
  | "wildcard"
  | "manager"
  | null;

export type PlayerLiveCard = {
  elementId: number;
  webName: string;
  teamShortName: string;
  teamCode: number;
  position: FplPosition;
  livePoints: number;
  minutes: number;
  status: PlayerStatus;
  isCaptain: boolean;
  isViceCaptain: boolean;
  /** What this manager's lineup multiplies the player by: 0 benched, 1 playing, 2 or 3 captain. */
  multiplier: number;
  photoUrl: string | null;
};

export type SquadSplit = {
  starters: PlayerLiveCard[];
  bench: PlayerLiveCard[];
};

export type CaptainStat = {
  elementId: number;
  webName: string;
  photoUrl: string | null;
  managerCount: number;
  percentage: number;
};

export type FixtureStatPlayer = {
  elementId: number;
  playerName: string;
  teamShortName: string;
  value: number;
};

export type LeagueFixtureStat = {
  key: string;
  label: string;
  home: FixtureStatPlayer[];
  away: FixtureStatPlayer[];
};

export type LeagueFixture = {
  id: number;
  kickoffTime: string | null;
  homeTeam: string;
  awayTeam: string;
  homeShortName: string;
  awayShortName: string;
  homeCode: number;
  awayCode: number;
  homeScore: number | null;
  awayScore: number | null;
  started: boolean;
  finished: boolean;
  finishedProvisional: boolean;
  minutes: number;
  stats: LeagueFixtureStat[];
};

export type LeagueRow = {
  entryId: number;
  rank: number;
  projectedRank: number;
  teamName: string;
  managerName: string;
  captainName: string;
  chip: Chip;
  playersPlayed: number;
  gwPoints: number;
  totalPoints: number;
  projectedTotalPoints: number;
  lineupPoints: number;
  transferCost: number;
  squad: SquadSplit;
  calculationStatus: "ok" | "partial";
  provisional: boolean;
};

export type LeagueLiveResponse = {
  league: {
    id: number;
    name: string;
    currentGw: number;
    lastUpdated: string;
    isProvisional: boolean;
    /** The next transfer deadline still ahead, or null once the season is over. */
    nextDeadline: { gw: number; deadlineTime: string } | null;
  };
  captainStats: CaptainStat[];
  fixtures: LeagueFixture[];
  rows: LeagueRow[];
  errors: string[];
};

export type ElementSummary = {
  id: number;
  webName: string;
  teamId: number;
  elementType: number;
  photo: string;
};

export type TeamSummary = {
  id: number;
  name: string;
  shortName: string;
  code: number;
};

export type FixtureSummary = {
  id: number;
  event: number;
  teamH: number;
  teamA: number;
  started: boolean;
  finished: boolean;
  finishedProvisional: boolean;
};

export type Pick = {
  element: number;
  position: number;
  multiplier: number;
  isCaptain: boolean;
  isViceCaptain: boolean;
};

export type EntryHistory = {
  event: number;
  points: number;
  total_points: number;
  event_transfers_cost: number;
};


export type EntryHistoryRow = {
  event: number;
  points: number;
  total_points: number;
  overall_rank: number | null;
  bank: number;
  value: number;
  event_transfers: number;
  event_transfers_cost: number;
  points_on_bench: number;
};

export type EntryHistoryPayload = {
  current: EntryHistoryRow[];
  chips: Array<{ name: string; event: number }>;
  past: Array<{ season_name: string; total_points: number; rank: number }>;
};

/** One chip the season grants, valid within a gameweek window. */
export type ChipDefinition = {
  name: string;
  start: number;
  stop: number;
};

export type ChipStatus = ChipDefinition & {
  label: string;
  /** Gameweek it was played in, or null while it is still in hand. */
  usedEvent: number | null;
  /** Window closed without the chip being played. */
  expired: boolean;
};

/** Season-long figures that FPL already returns alongside the weekly history. */
export type ManagerSeason = {
  chips: ChipStatus[];
  chipsRemaining: number;
  pointsOnBench: number;
  transfers: number;
  transferCost: number;
  /** Tenths of a million, as FPL reports it. */
  squadValue: number | null;
  bank: number | null;
  overallRank: number | null;
  pastSeasons: Array<{ seasonName: string; totalPoints: number; rank: number }>;
};

/** One player as the statistics tab shows them — all of it from bootstrap-static. */
export type PlayerStat = {
  id: number;
  webName: string;
  teamId: number;
  teamShortName: string;
  teamCode: number;
  position: FplPosition;
  /** Tenths of a million, as FPL reports it. */
  cost: number;
  costChangeEvent: number;
  /** −100…100 progress toward the next price move. */
  priceChangePercent: number;
  /** FPL's own projection of the progress figure at the next price update. */
  projectedPercent: number;
  /** ISO time before which FPL will not move this price, or null. */
  priceLockedUntil: string | null;
  totalPoints: number;
  eventPoints: number;
  form: number;
  pointsPerGame: number;
  selectedByPercent: number;
  transfersInEvent: number;
  transfersOutEvent: number;
  netTransfers: number;
  minutes: number;
  ictIndex: number;
  expectedGoalInvolvements: number;
  status: string;
  news: string;
  photoUrl: string | null;
};

export type TeamFixtureOutlook = {
  gw: number;
  opponent: string;
  home: boolean;
  difficulty: number;
};

/** A player seen through the league: who owns him and what that is worth. */
export type LeaguePlayerStat = {
  elementId: number;
  webName: string;
  teamShortName: string;
  teamCode: number;
  position: FplPosition;
  cost: number;
  ownedBy: number;
  /** Indexes into PlayerStatsResponse.managers. */
  owners: number[];
  captains: number[];
  starters: number;
  leaguePercent: number;
  /** Starters plus captain doubles, over the manager count. */
  effectiveOwnership: number;
  globalPercent: number;
  gwPoints: number;
  seasonPoints: number;
  /** Points this player has poured into the league as a whole. */
  leagueContribution: number;
  /** Points an owner gains on the league average this gameweek. */
  gwSwing: number;
  /** The same idea across the season, against today's ownership. */
  seasonSwing: number;
};

export type PremierLeagueTableRow = {
  position: number;
  team: string;
  shortName: string;
  teamCode: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  /** Last five results, oldest first. */
  form: Array<"W" | "D" | "L">;
  /** The team's next unstarted fixture, if one is scheduled. */
  next: { opponent: string; opponentCode: number; home: boolean } | null;
};

export type PlayerStatsResponse = {
  league: {
    id: number;
    name: string;
    currentGw: number;
    nextGw: number | null;
    managerCount: number;
    lastUpdated: string;
  };
  managers: Array<{ entryId: number; managerName: string; teamName: string; rank: number }>;
  players: PlayerStat[];
  /** Next five fixtures per team, keyed by short name. */
  fdr: Record<string, TeamFixtureOutlook[]>;
  /** Every fixture in the next seven gameweeks per team, keyed by short name; blanks and doubles intact. */
  outlook: Record<string, TeamFixtureOutlook[]>;
  /** Premier League standings from the season's results, a match in play included. */
  table: PremierLeagueTableRow[];
  leaguePlayers: LeaguePlayerStat[];
};

export type PlayerHistoryPoint = {
  gw: number;
  points: number;
  minutes: number;
  value: number;
  selected: number;
  transfersBalance: number;
};

export type PlayerHistoryResponse = {
  elementId: number;
  history: PlayerHistoryPoint[];
};

export type RankChangePoint = {
  gw: number;
  totalPoints: number;
  eventPoints: number;
  rank: number;
};

export type RankChangeManager = {
  entry: number;
  playerName: string;
  entryName: string;
  overallRank: number | null;
  totalPoints: number;
  latestRank: number | null;
  gwPoints: number;
  color: string;
  previousRank: number | null;
  season: ManagerSeason;
  /** Rank gained since the first tracked gameweek. Positive means moved up. */
  seasonChange: number | null;
  /** Rank gained across the recent window shown in the chart. */
  recentChange: number | null;
  trend: Array<RankChangePoint | null>;
};

export type RankChangeResponse = {
  league: {
    id: number;
    name: string;
    currentGw: number;
    lastUpdated: string;
  };
  trend: {
    gameweeks: number[];
  };
  managers: RankChangeManager[];
};

/** One line of a player's gameweek score — "득점 1 → 4점". */
export type PointsLine = {
  identifier: string;
  label: string;
  value: number;
  points: number;
};

export type PlayerPointsFixture = {
  fixtureId: number;
  opponent: string;
  home: boolean;
  kickoffTime: string | null;
  started: boolean;
  /** FPL has settled this fixture, so its bonus is final. */
  settled: boolean;
  minutes: number;
  lines: PointsLine[];
  /** Estimated from BPS, and only ever non-zero while FPL has yet to publish its own. */
  provisionalBonus: number;
  points: number;
};

export type PlayerPointsResponse = {
  elementId: number;
  gw: number;
  webName: string;
  teamShortName: string;
  position: FplPosition;
  /** What FPL has confirmed so far. */
  confirmedPoints: number;
  provisionalBonus: number;
  /** confirmedPoints + provisionalBonus — what the dashboard shows. */
  points: number;
  fixtures: PlayerPointsFixture[];
};
