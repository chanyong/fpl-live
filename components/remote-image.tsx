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

export function crestUrl(teamCode: number) {
  return teamCode > 0 ? `https://resources.premierleague.com/premierleague/badges/70/t${teamCode}.png` : null;
}
