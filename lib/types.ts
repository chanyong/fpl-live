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
