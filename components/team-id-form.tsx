"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useLocale } from "@/components/locale-provider";
import { parseTeamIdInput, saveMyTeam } from "@/lib/my-team";

/**
 * Type a FPL team ID and open its squad (issue #39 stage 2). `remember` saves the ID as "my team" in this
 * browser's storage; leave it off when the form is only for looking at someone else.
 */
export function TeamIdForm({
  remember = false,
  initial = "",
  compact = false
}: {
  remember?: boolean;
  initial?: string;
  compact?: boolean;
}) {
  const { tr } = useLocale();
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const [invalid, setInvalid] = useState(false);

  function submit(event: FormEvent) {
    event.preventDefault();
    const id = parseTeamIdInput(value);
    if (id === null) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    if (remember) {
      saveMyTeam({ id, name: null });
    }
    router.push(`/team/${id}`);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-1.5" noValidate>
      <div className="flex gap-2">
        <label className="sr-only" htmlFor="team-id-input">
          {tr("FPL 팀 ID", "FPL team ID")}
        </label>
        <input
          id="team-id-input"
          inputMode="numeric"
          autoComplete="off"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={tr("FPL 팀 ID (숫자)", "FPL team ID (digits)")}
          aria-invalid={invalid}
          aria-describedby={invalid ? "team-id-error" : undefined}
          className={`min-w-0 flex-1 rounded-md border bg-[var(--surface)] px-3 text-body-lg ${compact ? "h-10" : "h-11"} ${invalid ? "border-[var(--danger)]" : "border-[var(--border)]"}`}
        />
        <button
          type="submit"
          className={`shrink-0 rounded-md bg-[var(--accent)] px-4 text-body font-semibold text-white transition hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 ${compact ? "h-10" : "h-11"}`}
        >
          {tr("스쿼드 보기", "View squad")}
        </button>
      </div>
      {invalid ? (
        <p id="team-id-error" role="alert" className="text-caption text-[var(--danger)]">
          {tr("팀 ID는 숫자만 입력해 주세요.", "Enter the team ID as digits only.")}
        </p>
      ) : null}
    </form>
  );
}
