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
  position: FplPosition;
  livePoints: number;
  minutes: number;
  status: PlayerStatus;
  isCaptain: boolean;
  isViceCaptain: boolean;
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
  homeScore: number | null;
  awayScore: number | null;
  started: boolean;
  finished: boolean;
  finishedProvisional: boolean;
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
};

export type EntryHistoryPayload = {
  current: EntryHistoryRow[];
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
