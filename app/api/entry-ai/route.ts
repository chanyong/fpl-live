import { NextRequest, NextResponse } from "next/server";
import { checkEntryRequest } from "@/lib/entry-request-limit";
import { checkOwnTeam, ownTeamRefusal } from "@/lib/journal/own-team";
import { clientIp } from "@/lib/journal/rate-limit";
import { isSameOrigin } from "@/lib/journal/session";
import { aiGate, readBudgetNotice, readEntryAi, requestEntryAi, type AiOutcome, type BudgetNotice } from "@/lib/ai/recommend";
import { getAiDeps } from "@/lib/ai/runtime";
import type { Locale } from "@/lib/locale";
import { parseEntryId } from "@/lib/request-params";
import { EntryBusyError, EntryNotFoundError, FplUnavailableError } from "@/lib/xp/recommend";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE = { "Cache-Control": "no-store" };

function limitKey(headers: Headers) {
  return headers.get("x-real-ip")?.trim() || clientIp(headers);
}

function parseLocale(raw: unknown): Locale | null {
  return raw === "ko" || raw === "en" ? raw : null;
}

/**
 * The body a browser gets. Rules-based fallbacks (off, not allowed, cap reached, failed) are NOT errors: they
 * answer 200 with a status, so the screen shows the rules-based result and a one-line note. Only a running job
 * answers 202. The body never carries a prompt, a token count, a cost or an SDK message.
 */
function outcomeResponse(outcome: AiOutcome, extra: { budgetNotice?: BudgetNotice } = {}) {
  switch (outcome.status) {
    case "done":
      return NextResponse.json({ status: "done", ...outcome.value, ...extra }, { headers: NO_STORE });
    case "pending":
      return NextResponse.json({ status: "pending", previous: outcome.previous ?? null, ...extra }, { status: 202, headers: { ...NO_STORE, "Retry-After": "5" } });
    case "limit":
      return NextResponse.json({ status: "limit", reason: outcome.reason, previous: outcome.previous ?? null, ...extra }, { headers: NO_STORE });
    case "failed":
      return NextResponse.json({ status: "failed", code: outcome.code, ...extra }, { headers: NO_STORE });
    default:
      return NextResponse.json({ status: outcome.status, ...extra }, { headers: NO_STORE });
  }
}

function errorResponse(error: unknown, tag: string) {
  if (error instanceof EntryNotFoundError) {
    return NextResponse.json({ error: "Team not found" }, { status: 404, headers: NO_STORE });
  }
  if (error instanceof EntryBusyError) {
    return NextResponse.json(
      { error: "Busy. Please try again shortly.", retryAfterSeconds: error.retryAfterSeconds },
      { status: 503, headers: { ...NO_STORE, "Retry-After": String(error.retryAfterSeconds) } }
    );
  }
  if (error instanceof FplUnavailableError) {
    return NextResponse.json({ error: "FPL data is unavailable" }, { status: 502, headers: NO_STORE });
  }
  console.error(`[${tag}] unexpected error`);
  return NextResponse.json({ error: "Failed to build the analysis" }, { status: 500, headers: NO_STORE });
}

/**
 * Status of one team's AI analysis. Reads only; it cannot start a paid call. `?entryId=&locale=ko|en`
 * Members only, for the member's own registered team (issue #47), checked after the free "off" and "not allowed" answers.
 * When the layer is on and the team is allowed, the answer also carries `budgetNotice`: "near_limit" once this
 * month's counted usage is at 80% of the cap, else null (no amount, no token count).
 */
export async function GET(request: NextRequest) {
  const parsed = parseEntryId(request.nextUrl.searchParams.get("entryId"));
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400, headers: NO_STORE });
  }
  const locale = parseLocale(request.nextUrl.searchParams.get("locale"));
  if (!locale) {
    return NextResponse.json({ error: "locale must be ko or en" }, { status: 400, headers: NO_STORE });
  }

  try {
    const deps = getAiDeps();
    // Off and not-allowed answer first: they cost nothing. Then the own-team check, then the database read.
    const gate = aiGate(parsed.entryId, deps);
    if (gate) return outcomeResponse(gate);
    const refusal = ownTeamRefusal(await checkOwnTeam(request, parsed.entryId));
    if (refusal) return refusal;
    const outcome = await readEntryAi(parsed.entryId, locale, deps);
    if (outcome.status === "disabled" || outcome.status === "not_allowed") {
      return outcomeResponse(outcome);
    }
    return outcomeResponse(outcome, { budgetNotice: await readBudgetNotice(deps) });
  } catch (error) {
    return errorResponse(error, "entry-ai");
  }
}

/** Asks for the analysis: `{ entryId, locale, regenerate? }`. A stored copy is returned for free; otherwise a job starts and this answers 202. */
export async function POST(request: NextRequest) {
  // The login cookie authenticates this request, so a cross-site post must not get through (issue #47).
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403, headers: NO_STORE });
  }
  type Body = { entryId?: unknown; locale?: unknown; regenerate?: unknown };
  let body: Body | null = null;
  try {
    body = (await request.json()) as Body | null;
  } catch {
    body = null;
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "A JSON body is required" }, { status: 400, headers: NO_STORE });
  }

  const parsed = parseEntryId(typeof body.entryId === "number" || typeof body.entryId === "string" ? String(body.entryId) : null);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400, headers: NO_STORE });
  }
  const locale = parseLocale(body.locale);
  if (!locale) {
    return NextResponse.json({ error: "locale must be ko or en" }, { status: 400, headers: NO_STORE });
  }
  if (body.regenerate !== undefined && typeof body.regenerate !== "boolean") {
    return NextResponse.json({ error: "regenerate must be true or false" }, { status: 400, headers: NO_STORE });
  }

  const deps = getAiDeps();

  // Off and not-allowed answer before the per-IP brake: they cost nothing and must not use up someone's quota.
  const gate = aiGate(parsed.entryId, deps);
  if (gate) {
    return outcomeResponse(gate);
  }

  const refusal = ownTeamRefusal(await checkOwnTeam(request, parsed.entryId));
  if (refusal) return refusal;

  // The existing per-IP brake stays in front of every paid path (the real defences are the global caps and the allow list).
  const verdict = checkEntryRequest(limitKey(request.headers), parsed.entryId, body.regenerate === true);
  if (!verdict.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again shortly.", retryAfterSeconds: verdict.retryAfterSeconds },
      { status: 429, headers: { ...NO_STORE, "Retry-After": String(verdict.retryAfterSeconds) } }
    );
  }

  try {
    return outcomeResponse(await requestEntryAi({ entryId: parsed.entryId, locale, regenerate: body.regenerate === true }, deps));
  } catch (error) {
    return errorResponse(error, "entry-ai");
  }
}
