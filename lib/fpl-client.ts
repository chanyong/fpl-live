import {
  bootstrapStaticSchema,
  entrySchema,
  fixturesSchema,
  liveSchema,
  picksSchema,
  standingsPageSchema
} from "@/lib/validators";

const FPL_BASE_URL =
  process.env.FPL_BASE_URL ?? "https://fantasy.premierleague.com/api";

type FetchOptions = {
  forceRefresh?: boolean;
};

async function fetchJson<T>(
  path: string,
  schema: { parse: (value: unknown) => T },
  options: FetchOptions = {}
) {
  const response = await fetch(`${FPL_BASE_URL}${path}`, {
    headers: {
      Accept: "application/json"
    },
    next: options.forceRefresh ? undefined : { revalidate: 30 },
    cache: options.forceRefresh ? "no-store" : "force-cache"
  });

  if (!response.ok) {
    throw new Error(`FPL request failed: ${path} (${response.status})`);
  }

  return schema.parse((await response.json()) as unknown);
}

export function getBootstrapStatic(options?: FetchOptions) {
  return fetchJson("/bootstrap-static/", bootstrapStaticSchema, options);
}

export function getStandingsPage(
  leagueId: number,
  page: number,
  options?: FetchOptions
) {
  return fetchJson(
    `/leagues-classic/${leagueId}/standings/?page_new_entries=1&page_standings=${page}`,
    standingsPageSchema,
    options
  );
}

export async function getAllStandings(leagueId: number, options?: FetchOptions) {
  const firstPage = await getStandingsPage(leagueId, 1, options);
  const results = [...firstPage.standings.results];
  let page = 2;
  let hasNext = firstPage.standings.has_next;

  while (hasNext) {
    const nextPage = await getStandingsPage(leagueId, page, options);
    results.push(...nextPage.standings.results);
    hasNext = nextPage.standings.has_next;
    page += 1;
  }

  return {
    league: firstPage.league,
    results
  };
}

export function getEntry(entryId: number, options?: FetchOptions) {
  return fetchJson(`/entry/${entryId}/`, entrySchema, options);
}

export function getEntryPicks(
  entryId: number,
  gw: number,
  options?: FetchOptions
) {
  return fetchJson(`/entry/${entryId}/event/${gw}/picks/`, picksSchema, options);
}

export function getEventLive(gw: number, options?: FetchOptions) {
  return fetchJson(`/event/${gw}/live/`, liveSchema, options);
}

export function getFixtures(options?: FetchOptions) {
  return fetchJson("/fixtures/", fixturesSchema, options);
}
