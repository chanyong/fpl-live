import {
  bootstrapStaticSchema,
  elementSummarySchema,
  entryHistorySchema,
  entrySchema,
  fixturesSchema,
  liveSchema,
  picksSchema,
  standingsPageSchema
} from "@/lib/validators";

const FPL_BASE_URL =
  process.env.FPL_BASE_URL ?? "https://fantasy.premierleague.com/api";

const REQUEST_TIMEOUT_MS = Number(process.env.FPL_TIMEOUT_MS ?? 10_000);
const MAX_ATTEMPTS = Number(process.env.FPL_MAX_ATTEMPTS ?? 3);
const BASE_BACKOFF_MS = 400;
const MAX_BACKOFF_MS = 4_000;

class FplRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryable: boolean,
    readonly retryAfter: string | null
  ) {
    super(message);
    this.name = "FplRequestError";
  }
}

function isRetryableStatus(status: number) {
  return status === 429 || status === 408 || status >= 500;
}

function backoffDelay(attempt: number, retryAfterHeader: string | null) {
  const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : NaN;
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds >= 0) {
    return Math.min(retryAfterSeconds * 1000, MAX_BACKOFF_MS);
  }

  return Math.min(BASE_BACKOFF_MS * 2 ** attempt, MAX_BACKOFF_MS);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestOnce(path: string) {
  const response = await fetch(`${FPL_BASE_URL}${path}`, {
    headers: {
      Accept: "application/json"
    },
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });

  if (!response.ok) {
    throw new FplRequestError(
      `FPL request failed: ${path} (${response.status})`,
      response.status,
      isRetryableStatus(response.status),
      response.headers.get("Retry-After")
    );
  }

  return response;
}

function isTimeout(error: unknown) {
  return error instanceof DOMException && error.name === "TimeoutError";
}

async function fetchJson<T>(path: string, schema: { parse: (value: unknown) => T }) {
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await requestOnce(path);
      return schema.parse((await response.json()) as unknown);
    } catch (error) {
      lastError = error;

      // TypeError covers undici network failures; schema errors are never retried.
      const retryable =
        isTimeout(error) ||
        error instanceof TypeError ||
        (error instanceof FplRequestError && error.retryable);

      if (!retryable || attempt === MAX_ATTEMPTS - 1) {
        break;
      }

      await sleep(
        backoffDelay(attempt, error instanceof FplRequestError ? error.retryAfter : null)
      );
    }
  }

  if (isTimeout(lastError)) {
    throw new Error(`FPL request timed out after ${REQUEST_TIMEOUT_MS}ms: ${path}`);
  }

  throw lastError;
}

export function getBootstrapStatic() {
  return fetchJson("/bootstrap-static/", bootstrapStaticSchema);
}

export function getStandingsPage(leagueId: number, page: number) {
  return fetchJson(
    `/leagues-classic/${leagueId}/standings/?page_new_entries=1&page_standings=${page}`,
    standingsPageSchema
  );
}

export async function getAllStandings(leagueId: number) {
  const firstPage = await getStandingsPage(leagueId, 1);
  const results = [...firstPage.standings.results];
  let page = 2;
  let hasNext = firstPage.standings.has_next;

  while (hasNext) {
    const nextPage = await getStandingsPage(leagueId, page);
    results.push(...nextPage.standings.results);
    hasNext = nextPage.standings.has_next;
    page += 1;
  }

  return {
    league: firstPage.league,
    results
  };
}

export function getEntryHistory(entryId: number) {
  return fetchJson(`/entry/${entryId}/history/`, entryHistorySchema);
}

export function getEntry(entryId: number) {
  return fetchJson(`/entry/${entryId}/`, entrySchema);
}

export function getEntryPicks(entryId: number, gw: number) {
  return fetchJson(`/entry/${entryId}/event/${gw}/picks/`, picksSchema);
}

export function getEventLive(gw: number) {
  return fetchJson(`/event/${gw}/live/`, liveSchema);
}

export function getFixtures() {
  return fetchJson("/fixtures/", fixturesSchema);
}

export function getElementSummary(elementId: number) {
  return fetchJson(`/element-summary/${elementId}/`, elementSummarySchema);
}
