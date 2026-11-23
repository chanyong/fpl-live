"use client";

import { useCallback, useEffect, useState } from "react";
import { POLL_GIVE_UP_MS, POLL_INTERVAL_MS } from "@/components/ai-poll";
import type { FullDonePayload } from "@/lib/ai/full-flow";
import type { LimitReason } from "@/lib/ai/recommend";
import type { Locale } from "@/lib/locale";

/**
 * State of the "full AI" answer (issue #85): its own status read, 5-second polling while a job runs, and the
 * POST that starts a paid call. Nothing here posts by itself: `analyse` runs only when a person presses the
 * button, and the status is only read while the "full AI" box is ticked (`active`).
 */

type FullBody = (
  | { status: "none" | "disabled" | "not_allowed" }
  | ({ status: "done" } & FullDonePayload)
  | { status: "pending"; previous?: FullDonePayload | null }
  | { status: "limit"; reason: LimitReason; previous?: FullDonePayload | null }
  | { status: "failed"; code?: string }
) & { budgetNotice?: "near_limit" | null };

export type FullView =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "hidden" }
  | { phase: "none" }
  | { phase: "pending"; shown: FullDonePayload | null }
  | { phase: "timeout"; shown: FullDonePayload | null }
  | { phase: "done"; shown: FullDonePayload }
  | { phase: "failed"; shown: FullDonePayload | null; code: string | null }
  | { phase: "limit"; reason: LimitReason; shown: FullDonePayload | null };

const KNOWN = new Set(["none", "disabled", "not_allowed", "done", "pending", "limit", "failed"]);
const isBody = (value: unknown): value is FullBody =>
  typeof value === "object" && value !== null && KNOWN.has((value as { status?: unknown }).status as string);

async function readFull(entryId: number, locale: Locale): Promise<FullBody | null> {
  try {
    const response = await fetch(`/api/entry-ai?entryId=${entryId}&locale=${locale}&mode=full`);
    if (response.status !== 200 && response.status !== 202) return null;
    const body: unknown = await response.json();
    return isBody(body) ? body : null;
  } catch {
    return null;
  }
}

async function postFull(entryId: number, locale: Locale, regenerate: boolean): Promise<{ ok: true; body: FullBody } | { ok: false; status: number }> {
  try {
    const response = await fetch("/api/entry-ai", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ entryId, locale, regenerate, mode: "full" })
    });
    if (response.status !== 200 && response.status !== 202) return { ok: false, status: response.status };
    const body: unknown = await response.json();
    return isBody(body) ? { ok: true, body } : { ok: false, status: 0 };
  } catch {
    return { ok: false, status: 0 };
  }
}

const shownOf = (view: FullView): FullDonePayload | null => ("shown" in view ? view.shown : null);

function toView(body: FullBody, keep: FullDonePayload | null): FullView {
  switch (body.status) {
    case "none":
      return { phase: "none" };
    case "disabled":
    case "not_allowed":
      return { phase: "hidden" };
    case "done":
      return { phase: "done", shown: body };
    case "pending":
      return { phase: "pending", shown: body.previous ?? keep };
    case "limit":
      return { phase: "limit", reason: body.reason, shown: body.previous ?? keep };
    default:
      return { phase: "failed", shown: keep, code: body.code ?? null };
  }
}

export function useAiFull(entryId: number, locale: Locale, active: boolean) {
  const [view, setView] = useState<FullView>({ phase: "idle" });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<"too_many" | "request_failed" | null>(null);
  const [nearLimit, setNearLimit] = useState(false);

  // Ticking the box reads the status once; it never starts a paid call.
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    setView((current) => (current.phase === "idle" ? { phase: "loading" } : current));
    void readFull(entryId, locale).then((body) => {
      if (cancelled) return;
      if (body) setNearLimit(body.budgetNotice === "near_limit");
      setView((current) => (body ? toView(body, shownOf(current)) : { phase: "hidden" }));
    });
    return () => {
      cancelled = true;
    };
  }, [active, entryId, locale]);

  const polling = active && view.phase === "pending";
  useEffect(() => {
    if (!polling) return;
    const startedAt = Date.now();
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let inFlight = false;

    const schedule = () => {
      if (stopped || timer !== null || inFlight) return;
      if (Date.now() - startedAt >= POLL_GIVE_UP_MS) {
        setView((current) => (current.phase === "pending" ? { phase: "timeout", shown: current.shown } : current));
        return;
      }
      if (document.visibilityState === "hidden") return;
      timer = setTimeout(poll, POLL_INTERVAL_MS);
    };

    const poll = async () => {
      timer = null;
      inFlight = true;
      const body = await readFull(entryId, locale);
      inFlight = false;
      if (stopped) return;
      if (body) setNearLimit(body.budgetNotice === "near_limit");
      if (body && body.status === "pending") {
        setView((current) => (current.phase === "pending" ? { phase: "pending", shown: body.previous ?? current.shown } : current));
        schedule();
      } else if (body) {
        setView((current) => toView(body, shownOf(current)));
      } else {
        schedule();
      }
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") schedule();
    };
    document.addEventListener("visibilitychange", onVisible);
    schedule();
    return () => {
      stopped = true;
      if (timer !== null) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [polling, entryId, locale]);

  const analyse = useCallback(
    async (regenerate: boolean) => {
      setBusy(true);
      setNotice(null);
      const outcome = await postFull(entryId, locale, regenerate);
      setBusy(false);
      if (!outcome.ok) {
        setNotice(outcome.status === 429 ? "too_many" : "request_failed");
        return;
      }
      setView((current) => toView(outcome.body, shownOf(current)));
    },
    [entryId, locale]
  );

  return { view, busy, notice, nearLimit, analyse };
}
