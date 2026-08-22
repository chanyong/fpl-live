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
