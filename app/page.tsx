import { LeagueSearchForm } from "@/components/league-search-form";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-12">
      <section className="rounded-[2rem] border border-[var(--border)] bg-[var(--surface)]/95 p-6 shadow-[0_20px_80px_rgba(55,40,20,0.12)] md:p-8">
        <p className="text-sm uppercase tracking-[0.3em] text-[var(--muted)]">
          공식 FPL 라이브 대시보드
        </p>
        <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight md:text-5xl">
          경기가 진행되는 동안 미니리그 순위를 따라가세요.
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-8 text-[var(--muted)]">
          공개 클래식 리그 ID를 입력하면 게임위크 잠정 점수, 실시간 순위 변동, 매니저별 스쿼드
          현황을 볼 수 있습니다.
        </p>
        <LeagueSearchForm />
      </section>
    </main>
  );
}
