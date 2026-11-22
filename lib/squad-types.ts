import type { ChipStatus } from "@/lib/chip-availability";
import type { FplPosition } from "@/lib/types";

/** One fixture a squad player has in the coming gameweek. A blank gameweek has none, a double has two. */
export type SquadFixture = { opponent: string; home: boolean; difficulty: number };

export type SquadPlayer = {
  elementId: number;
  webName: string;
  teamShortName: string;
  teamCode: number;
  position: FplPosition;
  /** 1-11 starting XI in FPL's order, 12 the bench goalkeeper, 13-15 the substitutes in order. */
  pickPosition: number;
  isStarter: boolean;
  isCaptain: boolean;
  isViceCaptain: boolean;
  photoUrl: string | null;
  /** FPL availability flag: a available, d doubtful, i injured, s suspended, u unavailable, n not in squad. */
  status: string;
  news: string;
  /** Tenths of a million. */
  nowCost: number;
  /** Price paid, tenths; null when it could not be worked out. */
  purchaseCost: number | null;
  /** Estimated sale price, tenths; null when the purchase price is unknown. */
  sellingPrice: number | null;
  costChangeEvent: number;
  costChangeStart: number;
  form: number;
  selectedByPercent: number;
  /** Points in the squad's gameweek; null when they could not be loaded. */
  eventPoints: number | null;
  /** Fixtures in the next gameweek. */
  fixtures: SquadFixture[];
};

export type SquadTransferSummary = {
  /** Estimated free transfers for the next gameweek; null before any history. */
  freeTransfers: number | null;
  /** False when the rebuilt free-transfer history disagreed with a recorded cost (estimate less reliable). */
  freeTransfersMatchHistory: boolean;
  /** Transfers made / points paid for them in the last gameweek (recorded by FPL, not estimated). */
  lastGwTransfers: number;
  lastGwCost: number;
  /** Transfers FPL already lists for the next gameweek, if its public list shows any. Not in the squad above. */
  pendingTransfers: number;
};

export type EntrySquadPayload = {
  entryId: number;
  teamName: string;
  managerName: string;
  /** Gameweek the squad is read from: the last deadline that has passed. Null when the team has no history yet. */
  gw: number | null;
  /** True when that gameweek was a Free Hit, so the squad shown is the one from the week before. */
  freeHitFallback: boolean;
  nextGw: number | null;
  nextDeadline: string | null;
  /** Chip played in `gw`, if any. */
  activeChip: string | null;
  squad: SquadPlayer[];
  /** Tenths of a million. */
  bank: number;
  /** Sum of current prices of the 15. */
  squadValue: number;
  /** Sum of estimated selling prices; null if any is unknown. */
  squadSellingValue: number | null;
  chips: ChipStatus[];
  transfers: SquadTransferSummary;
  fetchedAt: number;
};
