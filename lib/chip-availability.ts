/**
 * Chip status for the squad screen (issue #39 stage 2): each chip the season grants (bootstrap `chips`, one row
 * per chip per half-season window) matched against the chips the manager has played (history `chips`).
 */
export type ChipWindow = { name: string; start_event: number; stop_event: number };
export type PlayedChip = { name: string; event: number };

export type ChipState =
  | { kind: "used"; event: number }
  /** Playable in the next gameweek. */
  | { kind: "available" }
  /** The window opens later. */
  | { kind: "later"; startEvent: number }
  /** The window closed without the chip being played. */
  | { kind: "expired" };

export type ChipStatus = {
  name: string;
  startEvent: number;
  stopEvent: number;
  state: ChipState;
};

const CHIP_ORDER = ["wildcard", "freehit", "bboost", "3xc", "manager"];
const chipRank = (name: string) => {
  const index = CHIP_ORDER.indexOf(name);
  return index === -1 ? CHIP_ORDER.length : index;
};

export function chipStatuses(windows: ChipWindow[], played: PlayedChip[], nextGw: number): ChipStatus[] {
  const remaining = [...played];

  return [...windows]
    .sort((a, b) => chipRank(a.name) - chipRank(b.name) || a.start_event - b.start_event)
    .map((window) => {
      const usedIndex = remaining.findIndex(
        (chip) => chip.name === window.name && chip.event >= window.start_event && chip.event <= window.stop_event
      );
      let state: ChipState;

      if (usedIndex !== -1) {
        state = { kind: "used", event: remaining[usedIndex].event };
        remaining.splice(usedIndex, 1);
      } else if (nextGw < window.start_event) {
        state = { kind: "later", startEvent: window.start_event };
      } else if (nextGw > window.stop_event) {
        state = { kind: "expired" };
      } else {
        state = { kind: "available" };
      }

      return { name: window.name, startEvent: window.start_event, stopEvent: window.stop_event, state };
    });
}
