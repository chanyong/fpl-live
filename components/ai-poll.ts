/** A running AI analysis is polled every 5 seconds, for 20 minutes at most (shared by the ranking and the full-AI views). */
export const POLL_INTERVAL_MS = 5_000;
export const POLL_GIVE_UP_MS = 20 * 60_000;
