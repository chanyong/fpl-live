"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useLocale } from "@/components/locale-provider";

export type ConfirmedTeam = { teamId: number; teamName: string; managerName: string };

type Lookup =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "found"; team: ConfirmedTeam }
  | { phase: "error"; code: string };

const inputClass = "mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2 text-body";
const lookupButtonClass = "mt-1 shrink-0 rounded-lg border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-2 text-body font-semibold disabled:opacity-60";

/**
 * FPL team number field with a lookup step (issue #47): "조회" shows the team's name and manager from FPL's public data, and
 * only after the person ticks "이 팀이 맞습니다" does onConfirmed receive the team. Typing in the field drops the lookup and
 * the confirmation, so a confirmed team is always the number currently in the box. Used by the sign-up form and by the
 * team change on the journal screen.
 */
export function TeamPicker({
  name,
  help,
  onConfirmed,
  disabled = false
}: {
  /** Form field name for the number, when the picker sits inside a form that reads it. */
  name?: string;
  help?: ReactNode;
  onConfirmed: (team: ConfirmedTeam | null) => void;
  disabled?: boolean;
}) {
  const { tr } = useLocale();
  const id = useId();
  const [text, setText] = useState("");
  const [lookup, setLookup] = useState<Lookup>({ phase: "idle" });
  const [confirmed, setConfirmed] = useState(false);
  // A late answer for a number that has since been edited must not show up.
  const requestId = useRef(0);
  useEffect(
    () => () => {
      requestId.current += 1;
    },
    []
  );

  const messages: Record<string, [string, string]> = {
    invalid_input: ["팀 번호는 숫자만 입력해 주세요.", "Enter the team ID as digits only."],
    team_not_found: ["FPL에서 이 팀 번호를 찾지 못했습니다.", "FPL has no team with this ID."],
    fpl_unavailable: ["FPL 서버가 응답하지 않습니다. 잠시 뒤 다시 시도해 주세요.", "FPL is not responding. Please try again shortly."],
    rate_limited: ["요청이 많아 잠시 막혔습니다. 잠시 뒤 다시 시도해 주세요.", "Too many requests. Please try again shortly."]
  };

  function edit(value: string) {
    requestId.current += 1;
    setText(value);
    setLookup({ phase: "idle" });
    setConfirmed(false);
    onConfirmed(null);
  }

  async function search() {
    const value = text.trim();
    if (!/^\d{1,10}$/.test(value) || Number(value) <= 0) {
      setLookup({ phase: "error", code: "invalid_input" });
      return;
    }
    const mine = ++requestId.current;
    setLookup({ phase: "loading" });
    setConfirmed(false);
    onConfirmed(null);
    try {
      const response = await fetch(`/api/journal/team-lookup?teamId=${value}`, { cache: "no-store" });
      const body = (await response.json().catch(() => ({}))) as { teamId?: unknown; teamName?: unknown; managerName?: unknown; error?: unknown };
      if (mine !== requestId.current) return;
      if (response.ok && typeof body.teamId === "number") {
        setLookup({
          phase: "found",
          team: { teamId: body.teamId, teamName: typeof body.teamName === "string" ? body.teamName : "", managerName: typeof body.managerName === "string" ? body.managerName : "" }
        });
      } else {
        setLookup({ phase: "error", code: typeof body.error === "string" && body.error in messages ? body.error : response.status === 429 ? "rate_limited" : "fpl_unavailable" });
      }
    } catch {
      if (mine === requestId.current) setLookup({ phase: "error", code: "fpl_unavailable" });
    }
  }

  const error = lookup.phase === "error" ? messages[lookup.code] : null;

  return (
    <div className="text-body">
      <label htmlFor={id}>{tr("FPL 팀 번호", "FPL team ID")}</label>
      <div className="flex items-start gap-2">
        <input
          id={id}
          name={name}
          inputMode="numeric"
          pattern="[0-9]+"
          required
          disabled={disabled}
          value={text}
          onChange={(event) => edit(event.target.value)}
          onKeyDown={(event) => {
            // Enter looks the number up; it must not submit the surrounding form before the team is confirmed.
            if (event.key === "Enter") {
              event.preventDefault();
              void search();
            }
          }}
          className={inputClass}
        />
        <button type="button" onClick={() => void search()} disabled={disabled || lookup.phase === "loading"} className={lookupButtonClass}>
          {lookup.phase === "loading" ? tr("조회 중…", "Looking up…") : tr("조회", "Look up")}
        </button>
      </div>
      {help ? <span className="mt-1 block text-sm text-[var(--muted)]">{help}</span> : null}
      {error ? (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {tr(error[0], error[1])}
        </p>
      ) : null}
      {lookup.phase === "found" ? (
        <div className="mt-2 rounded-md border border-[var(--border)] bg-[var(--bg)] p-3">
          <p className="font-semibold">{lookup.team.teamName || tr(`팀 ${lookup.team.teamId}`, `Team ${lookup.team.teamId}`)}</p>
          <p className="text-sm text-[var(--muted)]">
            {lookup.team.managerName ? `${lookup.team.managerName} · ` : ""}
            {tr(`팀 번호 ${lookup.team.teamId}`, `Team ID ${lookup.team.teamId}`)}
          </p>
          <label className="mt-2 flex items-start gap-2">
            <input
              type="checkbox"
              checked={confirmed}
              disabled={disabled}
              onChange={(event) => {
                setConfirmed(event.target.checked);
                onConfirmed(event.target.checked ? lookup.team : null);
              }}
              className="mt-1"
            />
            <span>{tr("이 팀이 맞습니다", "This is my team")}</span>
          </label>
        </div>
      ) : null}
    </div>
  );
}
