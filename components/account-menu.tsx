"use client";

import Link from "next/link";
import { useContext, useEffect, useRef, useState } from "react";
import { QueryClientContext, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale } from "@/components/locale-provider";
import { fetchMember } from "@/lib/journal/member-client";

type Tone = "app" | "home";

function UserIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M4.5 20c.8-3.6 3.8-5.6 7.5-5.6s6.7 2 7.5 5.6" />
    </svg>
  );
}

/**
 * Account button in the shared top band (issue #82): "Log in" (-> /journal login) for a visitor, a menu with
 * "My journal", "My team" and "Log out" for a member. Icon only on a narrow screen.
 */
export function AccountMenu({ tone = "app" }: { tone?: Tone }) {
  // The app always mounts the query provider; a bare header render (no provider) simply has no account button.
  const client = useContext(QueryClientContext);
  return client ? <AccountMenuInner tone={tone} /> : null;
}

function AccountMenuInner({ tone }: { tone: Tone }) {
  const { tr } = useLocale();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const { data: info } = useQuery({
    queryKey: ["journal-me"],
    queryFn: fetchMember,
    staleTime: 60_000,
    retry: false,
    refetchOnWindowFocus: false
  });

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const member = info === undefined ? undefined : info.member;
  // Unknown yet (or the answer failed): render nothing rather than flash a wrong state.
  if (member === undefined) return null;

  const buttonClass =
    tone === "home"
      ? "border border-white/40 text-[var(--paper)] hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      : "border border-[var(--border)] bg-[var(--surface)] text-[var(--accent-ink)] hover:border-[var(--accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]";
  const base = `inline-flex h-9 min-w-9 shrink-0 items-center justify-center gap-1.5 rounded-md px-2 text-caption font-semibold transition sm:px-3 ${buttonClass}`;

  if (!member) {
    return (
      <Link href="/journal" className={base} data-account="login" title={tr("로그인", "Log in")}>
        <UserIcon className="h-4 w-4" />
        <span className="hidden sm:inline">{tr("로그인", "Log in")}</span>
        <span className="sr-only sm:hidden">{tr("로그인", "Log in")}</span>
      </Link>
    );
  }

  async function logout() {
    setOpen(false);
    try {
      await fetch("/api/journal/logout", { method: "POST" });
    } finally {
      queryClient.setQueryData(["journal-me"], { member: false });
      await queryClient.invalidateQueries({ queryKey: ["journal-access"] });
      // The journal page keeps its own signed-in state; start it over so it shows the login form.
      if (window.location.pathname.startsWith("/journal")) window.location.reload();
    }
  }

  const itemClass =
    "block w-full px-3 py-2 text-left text-caption font-semibold text-[var(--text)] hover:bg-[var(--accent-soft)] focus:outline-none focus-visible:bg-[var(--accent-soft)]";
  return (
    <div ref={rootRef} className="relative" data-account="member">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        title={tr("내 일지", "My journal")}
        onClick={() => setOpen((value) => !value)}
        className={base}
      >
        <UserIcon className="h-4 w-4" />
        <span className="hidden sm:inline">{tr("내 일지", "My journal")}</span>
        <span className="sr-only sm:hidden">{tr("내 일지", "My journal")}</span>
      </button>
      {open ? (
        <div role="menu" className="absolute right-0 top-full z-30 mt-1 min-w-36 overflow-hidden rounded-md border border-[var(--border)] bg-[var(--surface)] py-1 shadow-lg">
          <Link role="menuitem" href="/journal" className={itemClass} onClick={() => setOpen(false)}>
            {tr("내 일지", "My journal")}
          </Link>
          <Link role="menuitem" href="/team" className={itemClass} onClick={() => setOpen(false)}>
            {tr("내 팀", "My team")}
          </Link>
          <button type="button" role="menuitem" onClick={logout} className={itemClass}>
            {tr("로그아웃", "Log out")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
