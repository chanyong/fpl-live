"use client";

import { useState } from "react";

/**
 * Premier League CDN art with a text fallback.
 *
 * Player photos and club crests are already in the payload and the host is
 * allow-listed in next.config.ts, but a missing file must not leave a hole.
 */
export function RemoteImage({
  src,
  alt,
  fallback,
  className,
  fallbackClassName
}: {
  src: string | null;
  alt: string;
  fallback: string;
  className: string;
  fallbackClassName: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <span className={fallbackClassName} aria-hidden="true">
        {fallback}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- plain img keeps the CDN fallback simple
    <img src={src} alt={alt} loading="lazy" decoding="async" className={className} onError={() => setFailed(true)} />
  );
}

/**
 * Club crests are switched off (issue #43, terms check of 2026-11-22: no Premier League logos or emblems on an
 * unofficial site). Every caller already draws its text fallback (the club's initial or nothing) when this is
 * null, so the screens keep their layout. To bring crests back, return the badge address here again.
 */
export function crestUrl(teamCode: number): string | null {
  void teamCode;
  return null;
}
