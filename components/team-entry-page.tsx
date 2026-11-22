"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LocaleToggle, useLocale } from "@/components/locale-provider";
import { SiteHeader } from "@/components/site-header";
import { TeamIdForm } from "@/components/team-id-form";
import { loadMyTeam } from "@/lib/my-team";

/**
 * /team: opens the team remembered in this browser, or asks for a team ID (issue #39 stage 2). The ID typed
 * here is saved as "my team"; the squad screen has its own form for looking at someone else without saving.
 */
export function TeamEntryPage() {
  const { tr } = useLocale();
  const router = useRouter();
  // "checking" until storage has been read, so a remembered team never flashes the empty form.
  const [state, setState] = useState<"checking" | "ask">("checking");

  useEffect(() => {
    const mine = loadMyTeam();
    if (mine) {
      router.replace(`/team/${mine.id}`);
    } else {
      setState("ask");
    }
  }, [router]);

  return (
    <main className="mx-auto flex min-h-screen max-w-[1440px] flex-col gap-3 px-2 py-3 md:px-4">
      <SiteHeader>
        <LocaleToggle />
      </SiteHeader>
      <header>
        <h1 className="text-2xl font-semibold leading-tight md:text-3xl">{tr("내 스쿼드 보기", "View my squad")}</h1>
        <p className="mt-1 text-body text-[var(--muted)]">
          {tr(
            "FPL 팀 ID를 입력하면 선발·벤치, 주장, 선수별 가격·판매가, 칩 현황, 은행 잔액과 무료 이적 수를 한 화면에서 봅니다. 로그인은 필요 없습니다.",
            "Enter your FPL team ID to see your lineup and bench, captain, prices and selling prices, chips, bank and free transfers on one screen. No login needed."
          )}
        </p>
      </header>

      {state === "checking" ? (
        <p role="status" className="text-body text-[var(--muted)]">
          {tr("불러오는 중…", "Loading…")}
        </p>
      ) : (
        <section className="max-w-xl rounded-md border border-[var(--border)] bg-[var(--surface)] p-4">
          <TeamIdForm remember />
          <p className="mt-3 text-caption leading-5 text-[var(--muted)]">
            {tr(
              "팀 ID는 FPL 사이트의 Points 화면 주소 fantasy.premierleague.com/entry/숫자/event/… 에서 ‘숫자’ 부분입니다. 입력한 ID는 이 브라우저에만 저장되고, 다음에 상단 ‘내 팀’을 누르면 바로 열립니다.",
              "The team ID is the number in the address of FPL's Points page, fantasy.premierleague.com/entry/NUMBER/event/…. It is saved in this browser only, and the “My team” menu opens it next time."
            )}
          </p>
          <p className="mt-2 text-caption leading-5 text-[var(--muted)]">
            {tr("리그 순위표에서 매니저 행을 누르면 그 팀의 스쿼드로 바로 갈 수도 있습니다. ", "In a league table, expanding a manager's row also links to their squad. ")}
            <Link href="/" className="font-semibold text-[var(--accent)] underline-offset-2 hover:underline">
              {tr("리그 ID 입력하러 가기", "Enter a league ID")}
            </Link>
          </p>
        </section>
      )}
    </main>
  );
}
