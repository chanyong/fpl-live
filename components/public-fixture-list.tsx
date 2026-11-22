"use client";

import { useLocale } from "@/components/locale-provider";
import { RemoteImage, crestUrl } from "@/components/remote-image";
import type { PublicFixture, PublicFixtureSide, PublicFixtureWeek } from "@/lib/public-football";

/**
 * Kickoffs are spelled in Korean time (KST), whatever the viewer's zone. The page is drawn on the server, and
 * a viewer-zone clock would differ between server and browser.
 */
const ZONE = "Asia/Seoul";

const DATE_FORMATTERS = {
  ko: new Intl.DateTimeFormat("ko-KR", { timeZone: ZONE, month: "long", day: "numeric", weekday: "short" }),
  en: new Intl.DateTimeFormat("en-GB", { timeZone: ZONE, day: "numeric", month: "short", weekday: "short" })
};
const TIME_FORMATTER = new Intl.DateTimeFormat("en-GB", { timeZone: ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

function Team({ side, align }: { side: PublicFixtureSide; align: "left" | "right" }) {
  const crest = (
    <RemoteImage
      src={crestUrl(side.code)}
      alt=""
      fallback={side.shortName.slice(0, 1)}
      className="h-6 w-6 shrink-0 object-contain"
      fallbackClassName="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--surface-strong)] text-caption font-semibold text-[var(--muted)]"
    />
  );

  return (
    <span className={`flex min-w-0 items-center gap-2 text-body-lg font-semibold ${align === "right" ? "flex-row-reverse text-right" : ""}`}>
      {crest}
      <span className="truncate">
        <span className="sm:hidden">{side.shortName}</span>
        <span className="hidden sm:inline">{side.name}</span>
      </span>
    </span>
  );
}

function Middle({ fixture }: { fixture: PublicFixture }) {
  const { tr } = useLocale();

  if (fixture.state === "upcoming") {
    const time = fixture.kickoffTime ? TIME_FORMATTER.format(new Date(fixture.kickoffTime)) : null;
    return (
      <span className="text-center text-body font-semibold tabular-nums text-[var(--muted)]">
        {time ?? tr("미정", "TBC")}
      </span>
    );
  }

  const live = fixture.state === "live";
  return (
    <span className="flex flex-col items-center leading-tight">
      <span className="text-body-lg font-bold tabular-nums">
        {fixture.home.score ?? "-"} - {fixture.away.score ?? "-"}
      </span>
      <span className={`text-caption font-semibold ${live ? "text-[var(--warning)]" : "text-[var(--muted)]"}`}>
        {live ? (fixture.minutes > 0 ? `${tr("진행 중", "Live")} ${fixture.minutes}'` : tr("진행 중", "Live")) : tr("종료", "Finished")}
      </span>
    </span>
  );
}

function dayGroups(fixtures: PublicFixture[], locale: "ko" | "en", tbc: string) {
  const groups: Array<{ label: string; fixtures: PublicFixture[] }> = [];
  for (const fixture of fixtures) {
    const label = fixture.kickoffTime ? DATE_FORMATTERS[locale].format(new Date(fixture.kickoffTime)) : tbc;
    const last = groups[groups.length - 1];
    if (last && last.label === label) {
      last.fixtures.push(fixture);
    } else {
      groups.push({ label, fixtures: [fixture] });
    }
  }
  return groups;
}

/** One gameweek's matches, grouped by day: kickoff time (KST) before the game, the score and status after. */
export function PublicFixtureList({ week, currentGw }: { week: PublicFixtureWeek; currentGw: number }) {
  const { tr, locale } = useLocale();
  const groups = dayGroups(week.fixtures, locale, tr("일정 미정", "Date TBC"));
  const headingId = `fixtures-gw-${week.gw}`;

  return (
    <section aria-labelledby={headingId} className="rounded-md border border-[var(--border)] bg-[var(--surface)] p-1.5 md:p-2">
      <div className="mb-1.5 px-1.5">
        <h2 id={headingId} className="text-body font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
          {tr(`게임위크 ${week.gw}`, `Gameweek ${week.gw}`)}
          {week.gw === currentGw ? ` · ${tr("이번 주", "This week")}` : null}
        </h2>
        <p className="mt-1 text-meta text-[var(--muted)]">{tr("킥오프는 한국 시각(KST) 기준", "Kickoff times in Korea Standard Time (KST)")}</p>
      </div>
      {groups.map((group) => (
        <div key={group.label} className="mb-2 last:mb-0">
          <h3 className="px-1.5 py-1 text-meta font-semibold text-[var(--muted)]">{group.label}</h3>
          <ul>
            {group.fixtures.map((fixture) => (
              <li
                key={fixture.id}
                className="grid grid-cols-[minmax(0,1fr)_64px_minmax(0,1fr)] items-center gap-2 border-t border-[var(--border)] px-1.5 py-2 sm:grid-cols-[minmax(0,1fr)_96px_minmax(0,1fr)]"
              >
                <Team side={fixture.home} align="right" />
                <Middle fixture={fixture} />
                <Team side={fixture.away} align="left" />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
