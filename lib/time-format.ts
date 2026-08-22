/** "방금 전" / "3분 전" — how stale the numbers on screen are. */
export function relativeTimeLabel(iso: string | null, now: number) {
  if (!iso) {
    return "-";
  }

  const timestamp = new Date(iso).getTime();
  if (!Number.isFinite(timestamp)) {
    return "-";
  }

  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (seconds < 10) {
    return "방금 전";
  }
  if (seconds < 60) {
    return `${seconds}초 전`;
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}분 전`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}시간 전`;
  }

  return `${Math.floor(hours / 24)}일 전`;
}

/** "2시간 15분 후" until kickoff, or null once the match is due. */
export function countdownLabel(iso: string | null, now: number) {
  if (!iso) {
    return null;
  }

  const timestamp = new Date(iso).getTime();
  if (!Number.isFinite(timestamp)) {
    return null;
  }

  const remaining = timestamp - now;
  if (remaining <= 0) {
    return null;
  }

  const minutes = Math.floor(remaining / 60_000);
  if (minutes < 60) {
    return `${Math.max(minutes, 1)}분 후`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    const rest = minutes % 60;
    return rest > 0 ? `${hours}시간 ${rest}분 후` : `${hours}시간 후`;
  }

  const days = Math.floor(hours / 24);
  const restHours = hours % 24;
  return restHours > 0 ? `${days}일 ${restHours}시간 후` : `${days}일 후`;
}
