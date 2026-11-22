"use client";

import Link from "next/link";
import { useLocale } from "@/components/locale-provider";

/**
 * Shown where the personal lineup, captain and transfer analysis would be, for anyone who is not signed in as the member
 * who registered this team (issue #47). Quiet on purpose: the squad above is public and complete without it.
 */
export function MemberOnlyNotice() {
  const { tr } = useLocale();
  return (
    <p className="px-1 text-meta text-[var(--muted)]">
      {tr("선발·캡틴·이적 분석은 이 팀을 등록한 회원에게만 보입니다.", "The lineup, captain and transfer analysis is shown only to the member who registered this team.")}{" "}
      <Link href="/journal" className="font-semibold underline underline-offset-2">
        {tr("로그인·가입", "Log in / sign up")}
      </Link>
    </p>
  );
}
