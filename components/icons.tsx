type IconProps = { className?: string };

/** Sort/expand affordances as real glyphs — these were ASCII stand-ins. */
export function CaretDown({ className }: IconProps) {
  return (
    <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" className={className}>
      <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CaretUp({ className }: IconProps) {
  return (
    <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" className={className}>
      <path d="M2.5 7.5 6 4l3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CaretRight({ className }: IconProps) {
  return (
    <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" className={className}>
      <path d="M4.5 2.5 8 6l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SortToggle({ className }: IconProps) {
  return (
    <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" className={className}>
      <path d="M6 2.2 8.4 5H3.6L6 2.2ZM6 9.8 3.6 7h4.8L6 9.8Z" fill="currentColor" opacity="0.45" />
    </svg>
  );
}

export function RefreshIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 14 14" width="14" height="14" aria-hidden="true" className={className}>
      <path d="M12 7a5 5 0 1 1-1.6-3.7" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M12.2 1.6v3h-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Top-menu glyphs (issue #39 stage 1): drawn on a 20px grid, stroke follows the text colour. */
const MENU_ICON_PROPS = {
  viewBox: "0 0 20 20",
  width: 18,
  height: 18,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true as const
};

/** EPL table: a ranked list. */
export function TableIcon({ className }: IconProps) {
  return (
    <svg {...MENU_ICON_PROPS} className={className}>
      <path d="M3 5h2M3 10h2M3 15h2M8 5h9M8 10h9M8 15h9" />
    </svg>
  );
}

/** Fixtures: a calendar. */
export function CalendarIcon({ className }: IconProps) {
  return (
    <svg {...MENU_ICON_PROPS} className={className}>
      <rect x="3" y="4.5" width="14" height="12.5" rx="2" />
      <path d="M3 8.5h14M7 2.8v3.4M13 2.8v3.4" />
    </svg>
  );
}

/** Players: a person. */
export function PlayerIcon({ className }: IconProps) {
  return (
    <svg {...MENU_ICON_PROPS} className={className}>
      <circle cx="10" cy="6.5" r="3" />
      <path d="M4 17c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" />
    </svg>
  );
}

/** Price changes: a line that rises and falls. */
export function PriceChangeIcon({ className }: IconProps) {
  return (
    <svg {...MENU_ICON_PROPS} className={className}>
      <path d="M2.5 13.5 7 9l3 3 5-6" />
      <path d="M11.5 6H15v3.5" />
    </svg>
  );
}
