"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/components/locale-provider";
import { TeamPicker, type ConfirmedTeam } from "@/components/team-picker";
import { CONTACT_EMAIL } from "@/lib/site";

function formatDate(iso: string, locale: string) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString(locale === "ko" ? "ko-KR" : "en-GB", { year: "numeric", month: "long", day: "numeric" });
}

const buttonClass = "rounded-lg bg-[var(--accent)] px-4 py-2 text-body font-semibold text-white disabled:opacity-60";

/**
 * The registered FPL team and the team change (issue #47). A change goes through the same lookup and "this is my team" step
 * as sign-up, then an in-page confirmation that says what is deleted and the 30-day wait; no browser dialogs.
 */
export function TeamRow({ teamId, nextChangeAt, onChanged }: { teamId: number | null; nextChangeAt: string | null; onChanged: () => void }) {
  const { tr, locale } = useLocale();
  const [name, setName] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<ConfirmedTeam | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [waitUntil, setWaitUntil] = useState<string | null>(nextChangeAt);

  useEffect(() => setWaitUntil(nextChangeAt), [nextChangeAt]);

  // The team name is a convenience: a failed lookup just leaves the number.
  useEffect(() => {
    if (teamId === null) return;
    let cancelled = false;
    setName(null);
    fetch(`/api/journal/team-lookup?teamId=${teamId}`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((body: { teamName?: unknown } | null) => {
        if (!cancelled && body && typeof body.teamName === "string" && body.teamName) setName(body.teamName);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [teamId]);

  const errors: Record<string, [string, string]> = {
    same_team: ["이미 등록된 팀입니다.", "That is already your registered team."],
    team_locked: ["이 계정의 팀은 바꿀 수 없게 고정돼 있습니다.", "The team on this account is locked and cannot be changed."],
    team_taken: [
      `이미 다른 계정에 등록된 팀 번호입니다. 본인 팀인데 막혔다면 ${CONTACT_EMAIL} 로 문의해 주세요.`,
      `Another account already has this team ID. If it is your team, contact ${CONTACT_EMAIL}.`
    ],
    team_not_found: ["FPL에서 이 팀 번호를 찾지 못했습니다.", "FPL has no team with this ID."],
    fpl_unavailable: ["FPL 서버가 응답하지 않습니다. 잠시 뒤 다시 시도해 주세요.", "FPL is not responding. Please try again shortly."],
    rate_limited: ["요청이 많아 잠시 막혔습니다. 잠시 뒤 다시 시도해 주세요.", "Too many requests. Please try again shortly."],
    unauthorized: ["로그인이 만료됐습니다. 다시 로그인해 주세요.", "Your login has expired. Please log in again."]
  };

  async function change() {
    if (!target) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/journal/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId: target.teamId })
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string; nextTeamChangeAt?: string };
      if (response.ok) {
        setOpen(false);
        setTarget(null);
        setMessage(tr("팀을 바꿨습니다. 자동 저장은 새 팀 기준으로 다시 쌓입니다.", "Your team was changed. Auto-saving now starts over for the new team."));
        onChanged();
        return;
      }
      if (body.error === "too_soon" && body.nextTeamChangeAt) {
        setWaitUntil(body.nextTeamChangeAt);
        setOpen(false);
        return;
      }
      const known = body.error ? errors[body.error] : undefined;
      setMessage(known ? tr(known[0], known[1]) : tr("처리하지 못했습니다. 잠시 뒤 다시 시도해 주세요.", "Something went wrong. Please try again."));
    } catch {
      setMessage(tr("처리하지 못했습니다. 잠시 뒤 다시 시도해 주세요.", "Something went wrong. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div role="group" aria-label={tr("등록한 팀", "Registered team")} className="mt-3 rounded-md border border-[var(--border)] bg-[var(--surface)] p-3 text-body">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span>
          <span className="text-[var(--muted)]">{tr("등록한 팀", "Registered team")}: </span>
          <span className="font-semibold">{name ? `${name} (#${teamId})` : `#${teamId ?? "-"}`}</span>
        </span>
        {!open && (
          <button
            type="button"
            onClick={() => {
              setOpen(true);
              setMessage(null);
            }}
            disabled={waitUntil !== null}
            className="font-semibold text-[var(--accent)] underline disabled:no-underline disabled:opacity-60"
          >
            {tr("팀 바꾸기", "Change team")}
          </button>
        )}
      </div>
      {waitUntil !== null && (
        <p role="status" className="mt-2 text-sm text-[var(--muted)]">
          {tr(
            `최근에 팀을 바꿔서 ${formatDate(waitUntil, locale)} 이후에 다시 바꿀 수 있습니다.`,
            `You changed teams recently, so you can change again after ${formatDate(waitUntil, locale)}.`
          )}
        </p>
      )}
      {open && (
        <div className="mt-3 space-y-3 border-t border-[var(--border)] pt-3">
          <TeamPicker onConfirmed={setTarget} disabled={busy} />
          {target && (
            <p role="note" className="text-sm leading-6">
              {tr(
                "자동 저장된 지난 기록은 지워지고 새 팀 기준으로 다시 쌓입니다. 직접 쓴 메모는 남습니다. 바꾼 뒤 30일 동안은 다시 바꿀 수 없습니다.",
                "The automatically saved past records are deleted and start over for the new team. Notes you wrote yourself are kept. After the change you cannot change again for 30 days."
              )}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void change()} disabled={!target || busy} className={buttonClass}>
              {busy ? tr("바꾸는 중…", "Changing…") : tr("이 팀으로 바꾸기", "Change to this team")}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setTarget(null);
                setMessage(null);
              }}
              disabled={busy}
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-body font-semibold disabled:opacity-60"
            >
              {tr("취소", "Cancel")}
            </button>
          </div>
        </div>
      )}
      {message && (
        <p role="status" className="mt-2 text-sm">
          {message}
        </p>
      )}
    </div>
  );
}
