"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { LocaleToggle, useLocale } from "@/components/locale-provider";
import { CONTACT_EMAIL } from "@/lib/site";
import type { WeeklySnapshot } from "@/lib/journal-snapshot";
import type { JournalNotes } from "@/lib/journal/types";

type Entries = {
  email: string;
  teamId: number | null;
  snapshots: Array<{ gw: number; snapshot: WeeklySnapshot }>;
  notes: JournalNotes[];
};

const FIELDS: Array<{ key: keyof Omit<JournalNotes, "gw">; ko: string; en: string }> = [
  { key: "review", ko: "이번 주 평가", en: "Weekly review" },
  { key: "good", ko: "잘한 점", en: "What went well" },
  { key: "bad", ko: "잘못한 점", en: "What went wrong" },
  { key: "plan", ko: "향후 계획", en: "Plan ahead" },
  { key: "principles", ko: "선수 관리 원칙", en: "Player management principles" }
];

const inputClass = "mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2 text-body";
const buttonClass = "rounded-lg bg-[var(--accent)] px-4 py-2 text-body font-semibold text-white disabled:opacity-60";

export function JournalPage() {
  const { tr } = useLocale();
  const [entries, setEntries] = useState<Entries | null>(null);
  const [state, setState] = useState<"loading" | "guest" | "ready" | "unavailable">("loading");

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/journal/entries", { cache: "no-store" });
      if (response.status === 401) return setState("guest");
      if (!response.ok) return setState("unavailable");
      setEntries((await response.json()) as Entries);
      setState("ready");
    } catch {
      setState("unavailable");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-12">
      <div className="flex items-center justify-between gap-3">
        <Link href="/" className="text-body font-semibold text-[var(--muted)] hover:text-[var(--accent)]">← FPL Live</Link>
        <LocaleToggle />
      </div>
      <h1 className="mt-6 text-3xl font-semibold leading-tight">{tr("주간 경기 리뷰 일지", "Weekly review journal")}</h1>
      <p className="mt-2 text-body text-[var(--muted)]">
        {tr(
          "내 FPL 팀 번호로 가입하면 게임위크가 끝날 때마다 점수·순위·선발·경기 결과가 자동 저장됩니다. 일지는 본인만 볼 수 있습니다. FPL 비밀번호는 받지 않습니다.",
          "Sign up with your FPL team ID and each finished gameweek's points, rank, squad and results are saved automatically. Only you can read your journal. We never ask for your FPL password."
        )}
      </p>

      {state === "loading" && <p className="mt-8 text-body text-[var(--muted)]">{tr("불러오는 중…", "Loading…")}</p>}
      {state === "unavailable" && (
        <p className="mt-8 text-body">{tr("일지 서비스를 아직 쓸 수 없습니다. 잠시 뒤 다시 시도해 주세요.", "The journal is not available yet. Please try again later.")}</p>
      )}
      {state === "guest" && <AuthForms onDone={load} />}
      {state === "ready" && entries && (
        <Journal
          entries={entries}
          onLogout={() => {
            setEntries(null);
            setState("guest");
          }}
        />
      )}
    </main>
  );
}

function AuthForms({ onDone }: { onDone: () => void }) {
  const { tr } = useLocale();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const messages: Record<string, [string, string]> = {
    team_not_found: ["FPL에서 이 팀 번호를 찾지 못했습니다.", "FPL has no team with this ID."],
    team_taken: [
      `이미 가입된 팀 번호입니다. 본인 팀인데 가입이 막혔다면 ${CONTACT_EMAIL} 로 문의해 주세요.`,
      `This team ID already has an account. If it is your team, contact ${CONTACT_EMAIL}.`
    ],
    invalid_input: ["입력을 확인해 주세요. 비밀번호는 8자 이상입니다.", "Check your input. Passwords need 8+ characters."],
    login_failed: [
      "이메일 또는 비밀번호가 맞지 않습니다. 가입 직후라면 확인 메일의 링크를 먼저 눌러 주세요.",
      "Wrong email or password. If you just signed up, confirm via the email link first."
    ]
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setMessage(null);
    try {
      const body = Object.fromEntries(form.entries());
      const response = await fetch(`/api/journal/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (response.ok && mode === "login") return onDone();
      if (response.ok) {
        setMode("login");
        return setMessage(tr("가입했습니다. 이메일로 간 확인 링크를 누른 뒤 로그인해 주세요.", "Signed up. Click the confirmation link in your email, then log in."));
      }
      const known = data.error ? messages[data.error] : undefined;
      setMessage(known ? tr(known[0], known[1]) : tr("처리하지 못했습니다. 잠시 뒤 다시 시도해 주세요.", "Something went wrong. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-4" aria-label={mode}>
      <div className="flex gap-3 text-body font-semibold">
        <button type="button" onClick={() => setMode("login")} className={mode === "login" ? "text-[var(--accent)] underline" : "text-[var(--muted)]"}>
          {tr("로그인", "Log in")}
        </button>
        <button type="button" onClick={() => setMode("signup")} className={mode === "signup" ? "text-[var(--accent)] underline" : "text-[var(--muted)]"}>
          {tr("가입", "Sign up")}
        </button>
      </div>
      <label className="block text-body">
        {tr("이메일", "Email")}
        <input name="email" type="email" required autoComplete="email" className={inputClass} />
      </label>
      <label className="block text-body">
        {tr("비밀번호", "Password")}
        <input
          name="password"
          type="password"
          required
          minLength={mode === "signup" ? 8 : 1}
          maxLength={72}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          className={inputClass}
        />
      </label>
      {mode === "signup" && (
        <label className="block text-body">
          {tr("FPL 팀 번호", "FPL team ID")}
          <input name="teamId" inputMode="numeric" pattern="[0-9]+" required className={inputClass} />
          <span className="mt-1 block text-sm text-[var(--muted)]">
            {tr("FPL 사이트 Points 화면 주소의 /entry/숫자/ 부분입니다. 팀 번호당 계정은 하나입니다.", "The number in /entry/<id>/ on the FPL Points page. One account per team.")}
          </span>
        </label>
      )}
      <button type="submit" disabled={busy} className={buttonClass}>
        {mode === "login" ? tr("로그인", "Log in") : tr("가입하기", "Sign up")}
      </button>
      {message && <p role="status" className="text-body">{message}</p>}
    </form>
  );
}

function Journal({ entries, onLogout }: { entries: Entries; onLogout: () => void }) {
  const { tr } = useLocale();
  const notesByGw = new Map(entries.notes.map((note) => [note.gw, note]));

  async function logout() {
    await fetch("/api/journal/logout", { method: "POST" });
    onLogout();
  }

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between gap-3 text-body">
        <span>
          {entries.email} · {tr("팀", "Team")} #{entries.teamId ?? "-"}
        </span>
        <button type="button" onClick={logout} className="font-semibold text-[var(--accent)] underline">
          {tr("로그아웃", "Log out")}
        </button>
      </div>
      {entries.snapshots.length === 0 ? (
        <p className="mt-6 text-body text-[var(--muted)]">
          {tr("아직 저장된 주가 없습니다. 게임위크가 끝나면 하루 두 번 도는 자동 저장이 채웁니다.", "No weeks saved yet. The twice-daily job fills in each gameweek once it finishes.")}
        </p>
      ) : (
        <ul className="mt-6 space-y-6">
          {entries.snapshots.map(({ gw, snapshot }) => (
            <WeekCard key={gw} snapshot={snapshot} notes={notesByGw.get(gw)} />
          ))}
        </ul>
      )}
    </section>
  );
}

function WeekCard({ snapshot, notes }: { snapshot: WeeklySnapshot; notes?: JournalNotes }) {
  const { tr } = useLocale();
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(FIELDS.map((field) => [field.key, notes?.[field.key] ?? ""]))
  );
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function save(event: FormEvent) {
    event.preventDefault();
    setStatus("saving");
    const response = await fetch("/api/journal/notes", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gw: snapshot.gw, ...values })
    });
    setStatus(response.ok ? "saved" : "error");
  }

  return (
    <li className="rounded-xl border border-[var(--border)] p-4">
      <h2 className="text-lg font-semibold">
        GW{snapshot.gw} · {snapshot.points}
        {tr("점", " pts")}
        {snapshot.transferCost > 0 ? ` (-${snapshot.transferCost})` : ""}
      </h2>
      <p className="mt-1 text-body text-[var(--muted)]">
        {tr("누적", "Total")} {snapshot.totalPoints} · {tr("순위", "Rank")} {snapshot.overallRank?.toLocaleString() ?? "-"} · {tr("이적", "Transfers")} {snapshot.transfers} · {tr("벤치", "Bench")} {snapshot.benchPoints}
        {snapshot.chip ? ` · ${snapshot.chip}` : ""}
      </p>
      <form onSubmit={save} className="mt-3 space-y-3">
        {FIELDS.map((field) => (
          <label key={field.key} className="block text-body">
            {tr(field.ko, field.en)}
            <textarea
              rows={2}
              maxLength={4000}
              value={values[field.key]}
              onChange={(event) => {
                setValues({ ...values, [field.key]: event.target.value });
                setStatus("idle");
              }}
              className={inputClass}
            />
          </label>
        ))}
        <div className="flex items-center gap-3">
          <button type="submit" disabled={status === "saving"} className={buttonClass}>
            {tr("저장", "Save")}
          </button>
          <span role="status" className="text-body text-[var(--muted)]">
            {status === "saved" && tr("저장했습니다", "Saved")}
            {status === "error" && tr("저장하지 못했습니다", "Could not save")}
          </span>
        </div>
      </form>
    </li>
  );
}
