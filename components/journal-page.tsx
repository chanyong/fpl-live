"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { JournalPitch, StepHeading } from "@/components/journal-pitch";
import { LocaleToggle, useLocale } from "@/components/locale-provider";
import { CONTACT_EMAIL } from "@/lib/site";
import type { WeeklySnapshot } from "@/lib/journal-snapshot";
import { parseJournalGw } from "@/lib/journal/gw-link";
import { passwordTooLong } from "@/lib/journal/password";
import { consumeAuthHash } from "@/lib/journal/recovery";
import type { JournalNotes } from "@/lib/journal/types";

type Entries = {
  email: string;
  teamId: number | null;
  snapshots: Array<{ gw: number; snapshot: WeeklySnapshot }>;
  notes: JournalNotes[];
};

type Field = { key: keyof Omit<JournalNotes, "gw">; ko: string; en: string; helpKo: string; helpEn: string; exKo: string; exEn: string };

const FIELDS: Field[] = [
  {
    key: "review", ko: "이번 주 평가", en: "Weekly review",
    helpKo: "점수와 순위가 어땠는지 한두 줄로 적어 두세요.", helpEn: "A line or two on how the week went.",
    exKo: "예) 평균보다 16점 높았지만 벤치에 24점이 남았다.", exEn: "e.g. 16 above average, but 24 points stayed on the bench."
  },
  {
    key: "good", ko: "잘한 점", en: "What went well",
    helpKo: "다음에도 반복하고 싶은 결정을 적습니다.", helpEn: "Decisions worth repeating.",
    exKo: "예) Rogers를 이적으로 데려와 9점을 얻었다.", exEn: "e.g. Bringing in Rogers paid off with 9 points."
  },
  {
    key: "bad", ko: "잘못한 점", en: "What went wrong",
    helpKo: "아쉬웠던 선택과 그 이유를 적습니다.", helpEn: "Choices you regret, and why.",
    exKo: "예) 주장을 Haaland로 정했는데 무득점이었다.", exEn: "e.g. Captained Haaland and he blanked."
  },
  {
    key: "plan", ko: "향후 계획", en: "Plan ahead",
    helpKo: "다음 게임위크에 할 일(이적·칩·주장)을 적습니다.", helpEn: "What you will do next week (transfers, chips, captain).",
    exKo: "예) 부상 선수를 정리하고 이적 1회만 쓴다.", exEn: "e.g. Replace the injured player, one transfer only."
  },
  {
    key: "principles", ko: "선수 관리 원칙", en: "Player management principles",
    helpKo: "시즌 내내 지킬 기준을 적습니다.", helpEn: "Rules you want to keep all season.",
    exKo: "예) 이적 감점은 한 주 4점 이하로 제한한다.", exEn: "e.g. Keep transfer hits to 4 points a week."
  }
];

const inputClass = "mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2 text-body";
const buttonClass = "rounded-lg bg-[var(--accent)] px-4 py-2 text-body font-semibold text-white disabled:opacity-60";

export function JournalPage() {
  const { tr } = useLocale();
  const [entries, setEntries] = useState<Entries | null>(null);
  const [state, setState] = useState<"loading" | "guest" | "ready" | "unavailable" | "failed" | "recovery">("loading");
  const [recoveryToken, setRecoveryToken] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  // /journal?gw=12 (from the league page) opens that week; it is read after mount so the server render stays the same.
  const [focusGw, setFocusGw] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/journal/entries", { cache: "no-store" });
      if (response.status === 401) return setState("guest");
      if (response.status === 502) return setState("failed");
      if (!response.ok) return setState("unavailable");
      setEntries((await response.json()) as Entries);
      setState("ready");
    } catch {
      setState("unavailable");
    }
  }, []);

  useEffect(() => {
    setFocusGw(parseJournalGw(window.location.search));
  }, []);

  useEffect(() => {
    // A password-reset mail link comes back as /journal#access_token=...&type=recovery. Read it once, then clear it from the URL.
    const fromMail = consumeAuthHash(window.location, window.history);
    if (fromMail?.kind === "recovery") {
      setRecoveryToken(fromMail.accessToken);
      setState("recovery");
      return;
    }
    if (fromMail?.kind === "confirmed") {
      setNotice(tr("이메일 확인이 끝났습니다. 로그인해 주세요.", "Email confirmed. Please log in."));
    }
    if (fromMail?.kind === "error") {
      setNotice(tr("메일의 링크가 만료됐거나 이미 사용됐습니다. 아래에서 다시 요청해 주세요.", "The email link has expired or was already used. Please request a new one below."));
    }
    void load();
  }, [load]);

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col px-4 py-10 sm:px-6 sm:py-12">
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
      {state === "failed" && (
        <p role="alert" className="mt-8 text-body">
          {tr("일지를 불러오지 못했습니다. 기존 기록을 지키려고 저장을 막았습니다. 잠시 뒤 새로고침해 주세요.", "Could not load your journal. Saving is disabled to protect existing notes. Please refresh in a moment.")}
        </p>
      )}
      {state === "guest" && focusGw !== null && (
        <p className="mt-6 text-body text-[var(--muted)]">
          {tr(`로그인하면 GW${focusGw} 일지로 이동합니다.`, `Log in to open your GW${focusGw} journal.`)}
        </p>
      )}
      {state === "guest" && <AuthForms key={notice ?? "plain"} onDone={load} initialMessage={notice} />}
      {state === "recovery" && (
        <ResetPasswordForm
          token={recoveryToken}
          onDone={() => {
            setRecoveryToken("");
            setNotice(tr("비밀번호를 바꿨습니다. 새 비밀번호로 로그인해 주세요.", "Your password was changed. Please log in with the new password."));
            setState("guest");
          }}
          onExpired={() => {
            setRecoveryToken("");
            setNotice(tr("메일의 링크가 만료됐거나 이미 사용됐습니다. 아래에서 다시 요청해 주세요.", "The email link has expired or was already used. Please request a new one below."));
            setState("guest");
          }}
        />
      )}
      {state === "ready" && entries && (
        <Journal
          entries={entries}
          focusGw={focusGw}
          onLogout={() => {
            setEntries(null);
            setState("guest");
          }}
        />
      )}
    </main>
  );
}

const COOLDOWN_MS = 60_000;

export function AuthForms({ onDone, initialMessage = null }: { onDone: () => void; initialMessage?: string | null }) {
  const { tr } = useLocale();
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [message, setMessage] = useState<string | null>(initialMessage);
  const [unconfirmed, setUnconfirmed] = useState<string | null>(null);
  const [cooling, setCooling] = useState(false);
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const mismatch = mode === "signup" && confirm !== "" && password !== confirm;
  const tooLong = mode === "signup" && passwordTooLong(password);

  const messages: Record<string, [string, string]> = {
    team_not_found: ["FPL에서 이 팀 번호를 찾지 못했습니다.", "FPL has no team with this ID."],
    fpl_unavailable: ["FPL 서버가 응답하지 않습니다. 잠시 뒤 다시 시도해 주세요.", "FPL is not responding. Please try again shortly."],
    team_taken: [
      `이미 가입된 팀 번호입니다. 본인 팀인데 가입이 막혔다면 ${CONTACT_EMAIL} 로 문의해 주세요.`,
      `This team ID already has an account. If it is your team, contact ${CONTACT_EMAIL}.`
    ],
    invalid_input: ["입력을 확인해 주세요. 비밀번호는 8자 이상입니다.", "Check your input. Passwords need 8+ characters."],
    email_not_confirmed: [
      "이메일 확인이 아직 안 됐습니다. 메일의 확인 링크를 눌러 주세요.",
      "Your email is not confirmed yet. Please click the confirmation link in the email."
    ],
    login_failed: [
      "이메일 또는 비밀번호가 맞지 않습니다. 가입 직후라면 확인 메일의 링크를 먼저 눌러 주세요.",
      "Wrong email or password. If you just signed up, confirm via the email link first."
    ]
  };

  const coolTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (coolTimer.current) clearTimeout(coolTimer.current);
    },
    []
  );

  function startCooldown() {
    setCooling(true);
    if (coolTimer.current) clearTimeout(coolTimer.current);
    coolTimer.current = setTimeout(() => setCooling(false), COOLDOWN_MS);
  }

  async function resend() {
    if (!unconfirmed || cooling) return;
    setBusy(true);
    try {
      await fetch("/api/journal/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: unconfirmed })
      });
      startCooldown();
      setMessage(tr("확인 메일을 다시 보냈습니다. 도착하지 않으면 스팸함을 확인하고, 1분 뒤 다시 요청해 주세요.", "We sent the confirmation email again. If it does not arrive, check spam and try again in a minute."));
    } catch {
      setMessage(tr("처리하지 못했습니다. 잠시 뒤 다시 시도해 주세요.", "Something went wrong. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mode === "signup" && (password !== confirm || tooLong)) return;
    const form = new FormData(event.currentTarget);
    form.delete("passwordConfirm");
    setBusy(true);
    setMessage(null);
    setUnconfirmed(null);
    try {
      const body = Object.fromEntries(form.entries());
      if (mode === "forgot") {
        // The answer is the same whether or not the email has an account.
        const reset = await fetch("/api/journal/recover", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: body.email })
        });
        if (reset.ok) {
          startCooldown();
          return setMessage(
            tr(
              "입력하신 주소로 가입된 계정이 있으면 비밀번호 재설정 메일을 보냈습니다. 메일이 안 보이면 스팸함을 확인하고, 1분 뒤 다시 요청해 주세요.",
              "If an account exists for that address, we sent a password reset email. If you do not see it, check spam and try again in a minute."
            )
          );
        }
        return setMessage(tr(messages.invalid_input[0], messages.invalid_input[1]));
      }
      const response = await fetch(`/api/journal/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (response.ok && mode === "login") return onDone();
      if (response.ok) {
        setMode("login");
        setConfirm("");
        setUnconfirmed(String(body.email ?? ""));
        startCooldown();
        return setMessage(
          tr(
            "확인 메일을 보냈습니다. 메일함(스팸함 포함)의 링크를 눌러야 로그인할 수 있습니다. 안 오면 1분 뒤 아래 버튼으로 다시 받을 수 있습니다.",
            "We sent a confirmation email. Click the link in it (check spam too) before logging in. If it does not arrive, you can resend it below after a minute."
          )
        );
      }
      if (data.error === "email_not_confirmed") setUnconfirmed(String(body.email ?? ""));
      const known = data.error ? messages[data.error] : undefined;
      setMessage(known ? tr(known[0], known[1]) : tr("처리하지 못했습니다. 잠시 뒤 다시 시도해 주세요.", "Something went wrong. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-4" aria-label={mode}>
      <div role="tablist" aria-label={tr("로그인 또는 가입 선택", "Choose log in or sign up")} className="grid grid-cols-2 border-b border-[var(--border)]">
        {(
          [
            ["login", tr("로그인", "Log in")],
            ["signup", tr("가입", "Sign up")]
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={mode === value}
            tabIndex={mode === value ? 0 : -1}
            onClick={() => {
              setMode(value);
              setMessage(null);
              setUnconfirmed(null);
            }}
            onKeyDown={(event) => {
              if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
              event.preventDefault();
              const next = value === "login" ? "signup" : "login";
              setMode(next);
              setMessage(null);
              (event.currentTarget.parentElement?.querySelector(`[data-tab="${next}"]`) as HTMLElement | null)?.focus();
            }}
            data-tab={value}
            className={`-mb-px min-h-10 border-b-2 px-4 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${
              mode === value
                ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] font-bold text-[var(--accent)]"
                : "border-transparent font-medium text-[var(--muted)] hover:text-[var(--accent)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <label className="block text-body">
        {tr("이메일", "Email")}
        <input name="email" type="email" required autoComplete="email" className={inputClass} />
      </label>
      {mode === "forgot" && (
        <p className="text-body text-[var(--muted)]">
          {tr("가입한 이메일을 입력하면 비밀번호를 다시 정하는 링크를 보내 드립니다.", "Enter your email and we will send you a link to choose a new password.")}
        </p>
      )}
      {mode !== "forgot" && (
      <label className="block text-body">
        {tr("비밀번호", "Password")}
        <input
          name="password"
          type="password"
          required
          minLength={mode === "signup" ? 8 : 1}
          maxLength={mode === "signup" ? undefined : 72}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className={inputClass}
        />
      </label>
      )}
      {mode === "signup" && (
        <label className="block text-body">
          {tr("비밀번호 확인", "Confirm password")}
          <input
            name="passwordConfirm"
            type="password"
            required
            autoComplete="new-password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            aria-invalid={mismatch}
            aria-describedby={mismatch ? "password-mismatch" : undefined}
            className={inputClass}
          />
        </label>
      )}
      {mismatch && (
        <p id="password-mismatch" role="alert" className="text-sm text-red-700">
          {tr("비밀번호가 서로 다릅니다. 다시 확인해 주세요.", "Passwords do not match. Please check again.")}
        </p>
      )}
      {tooLong && <p role="alert" className="text-sm text-red-700">{tr("비밀번호가 너무 깁니다. 72바이트 이하(영문 72자, 한글 약 24자)여야 합니다.", "Password is too long: 72 bytes max (72 letters; about 24 Korean characters).")}</p>}
      {mode === "signup" && (
        <label className="block text-body">
          {tr("FPL 팀 번호", "FPL team ID")}
          <input name="teamId" inputMode="numeric" pattern="[0-9]+" required className={inputClass} />
          <span className="mt-1 block text-sm text-[var(--muted)]">
            {tr("FPL 사이트 Points 화면 주소의 /entry/숫자/ 부분입니다. 팀 번호당 계정은 하나입니다.", "The number in /entry/<id>/ on the FPL Points page. One account per team.")}
          </span>
        </label>
      )}
      {mode === "signup" && (
        <label className="flex items-start gap-2 text-body">
          <input name="consent" type="checkbox" required className="mt-1" />
          <span>
            {tr("만 14세 이상이며 ", "I am 14 or older and have read the ")}
            <Link href="/privacy" className="font-semibold text-[var(--accent)] underline">{tr("개인정보처리방침", "Privacy Policy")}</Link>
            {tr("을 확인했습니다.", ".")}
          </span>
        </label>
      )}
      <button type="submit" disabled={busy || mismatch || tooLong || (mode === "forgot" && cooling)} className={buttonClass}>
        {mode === "login" ? tr("로그인", "Log in") : mode === "signup" ? tr("가입하기", "Sign up") : tr("재설정 메일 보내기", "Send reset email")}
      </button>
      {mode !== "signup" && (
        <button
          type="button"
          onClick={() => {
            setMode(mode === "login" ? "forgot" : "login");
            setMessage(null);
            setUnconfirmed(null);
          }}
          className="block text-body font-semibold text-[var(--accent)] underline"
        >
          {mode === "login" ? tr("비밀번호를 잊으셨나요?", "Forgot your password?") : tr("← 로그인으로 돌아가기", "← Back to log in")}
        </button>
      )}
      {message && <p role="status" className="text-body">{message}</p>}
      {unconfirmed && mode === "login" && (
        <button type="button" onClick={resend} disabled={busy || cooling} className={buttonClass}>
          {tr("확인 메일 다시 보내기", "Resend confirmation email")}
        </button>
      )}
    </form>
  );
}

export function ResetPasswordForm({ token, onDone, onExpired }: { token: string; onDone: () => void; onExpired: () => void }) {
  const { tr } = useLocale();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const mismatch = confirm !== "" && password !== confirm;
  const tooLong = passwordTooLong(password);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password !== confirm || tooLong) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/journal/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: token, password })
      });
      if (response.ok) return onDone();
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (data.error === "link_expired") return onExpired();
      setMessage(
        data.error === "invalid_input"
          ? tr("비밀번호는 8자 이상이어야 합니다.", "Passwords need 8+ characters.")
          : tr("비밀번호를 바꾸지 못했습니다. 이전과 다른 비밀번호로 다시 시도해 주세요.", "Could not change the password. Please try a different one.")
      );
    } catch {
      setMessage(tr("처리하지 못했습니다. 잠시 뒤 다시 시도해 주세요.", "Something went wrong. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-4" aria-label="reset-password">
      <h2 className="text-lg font-semibold">{tr("새 비밀번호 정하기", "Choose a new password")}</h2>
      <label className="block text-body">
        {tr("새 비밀번호", "New password")}
        <input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className={inputClass} />
      </label>
      <label className="block text-body">
        {tr("새 비밀번호 확인", "Confirm new password")}
        <input
          type="password"
          required
          autoComplete="new-password"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          aria-invalid={mismatch}
          className={inputClass}
        />
      </label>
      {mismatch && (
        <p role="alert" className="text-sm text-red-700">
          {tr("비밀번호가 서로 다릅니다. 다시 확인해 주세요.", "Passwords do not match. Please check again.")}
        </p>
      )}
      {tooLong && <p role="alert" className="text-sm text-red-700">{tr("비밀번호가 너무 깁니다. 72바이트 이하(영문 72자, 한글 약 24자)여야 합니다.", "Password is too long: 72 bytes max (72 letters; about 24 Korean characters).")}</p>}
      <button type="submit" disabled={busy || mismatch || tooLong} className={buttonClass}>
        {tr("비밀번호 바꾸기", "Change password")}
      </button>
      {message && <p role="status" className="text-body">{message}</p>}
    </form>
  );
}

function Journal({ entries, focusGw, onLogout }: { entries: Entries; focusGw: number | null; onLogout: () => void }) {
  const { tr } = useLocale();
  const notesByGw = new Map(entries.notes.map((note) => [note.gw, note]));
  const focusSaved = focusGw !== null && entries.snapshots.some((item) => item.gw === focusGw);

  useEffect(() => {
    if (!focusSaved) return;
    const card = document.getElementById(`gw-${focusGw}`);
    card?.scrollIntoView?.({ block: "start" });
    card?.querySelector("textarea")?.focus({ preventScroll: true });
  }, [focusGw, focusSaved]);

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
      {focusGw !== null && !focusSaved && (
        <p role="status" className="mt-4 text-body">
          {tr(
            `GW${focusGw} 일지는 게임위크가 끝나고 자동 저장된 뒤에 쓸 수 있습니다.`,
            `The GW${focusGw} journal opens after the gameweek finishes and is saved automatically.`
          )}
        </p>
      )}
      {entries.snapshots.length === 0 ? (
        <p className="mt-6 text-body text-[var(--muted)]">
          {tr("아직 저장된 주가 없습니다. 게임위크가 끝나면 하루 두 번 도는 자동 저장이 채웁니다.", "No weeks saved yet. The twice-daily job fills in each gameweek once it finishes.")}
        </p>
      ) : (
        <ul className="mt-6 space-y-6">
          {entries.snapshots.map(({ gw, snapshot }, index) => (
            <WeekCard
              key={gw}
              snapshot={snapshot}
              previous={entries.snapshots.find((item) => item.gw === gw - 1)?.snapshot ?? null}
              notes={notesByGw.get(gw)}
              highlighted={gw === focusGw}
              defaultOpen={focusGw !== null && focusSaved ? gw === focusGw : index === 0}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function WeekCard({
  snapshot,
  previous = null,
  notes,
  highlighted = false,
  defaultOpen = true
}: {
  snapshot: WeeklySnapshot;
  previous?: WeeklySnapshot | null;
  notes?: JournalNotes;
  highlighted?: boolean;
  defaultOpen?: boolean;
}) {
  const { tr } = useLocale();
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(FIELDS.map((field) => [field.key, notes?.[field.key] ?? ""]))
  );
  const [status, setStatus] = useState<"idle" | "dirty" | "saving" | "saved" | "error">("idle");

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

  const filled = FIELDS.filter((field) => values[field.key].trim() !== "").length;

  return (
    <li
      id={`gw-${snapshot.gw}`}
      className={`scroll-mt-4 rounded-md border bg-[var(--surface)] p-3 md:p-4 ${highlighted ? "border-[var(--accent)] ring-2 ring-[var(--accent)]" : "border-[var(--border)]"}`}
    >
      <h2 className="flex flex-wrap items-baseline gap-x-2 text-title-lg font-semibold">
        <span>GW{snapshot.gw}</span>
        <span className="tabular-nums">
          {snapshot.points}
          {tr("점", " pts")}
          {snapshot.transferCost > 0 ? ` (-${snapshot.transferCost})` : ""}
        </span>
        <span className="text-meta font-normal text-[var(--muted)]">
          {tr("일지", "Journal")} {filled}/{FIELDS.length}
        </span>
      </h2>
      <details open={defaultOpen} className="mt-2">
        <summary className="cursor-pointer rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-body font-semibold">
          {tr("선수·경기 결과 보기", "Squad and results")}
        </summary>
        <JournalPitch snapshot={snapshot} previous={previous} />
      </details>
      <form onSubmit={save} className="mt-6 space-y-4 border-t border-[var(--border)] pt-5">
        <StepHeading step={4} title={tr("이번 주 일지 쓰기", "Write this week's journal")} hint={tr("위 결과를 보면서 적으세요. 비워 둔 칸은 건너뛰어도 됩니다.", "Write with the results above in view. You may skip any box.")} />
        {FIELDS.map((field) => (
          <label key={field.key} className="block">
            <span className="block text-body-lg font-semibold">{tr(field.ko, field.en)}</span>
            <span className="block text-meta text-[var(--muted)]">{tr(field.helpKo, field.helpEn)}</span>
            <textarea
              rows={3}
              maxLength={4000}
              placeholder={tr(field.exKo, field.exEn)}
              value={values[field.key]}
              onChange={(event) => {
                setValues({ ...values, [field.key]: event.target.value });
                setStatus("dirty");
              }}
              className="mt-1.5 w-full rounded-md border border-[var(--border)] bg-[var(--bg)] p-2.5 text-body-lg placeholder:text-[var(--muted)]/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
            />
          </label>
        ))}
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={status === "saving"} className={buttonClass}>
            {status === "saving" ? tr("저장 중…", "Saving…") : tr("저장", "Save")}
          </button>
          <span role="status" className="text-body">
            {status === "dirty" && <span className="text-[var(--muted)]">{tr("저장하지 않은 변경이 있습니다", "Unsaved changes")}</span>}
            {status === "saved" && <span className="font-semibold text-[var(--accent)]">{tr("✓ 저장했습니다", "✓ Saved")}</span>}
            {status === "error" && <span className="font-semibold text-[var(--danger)]">{tr("저장하지 못했습니다. 다시 시도해 주세요", "Could not save. Please try again")}</span>}
          </span>
        </div>
      </form>
    </li>
  );
}
