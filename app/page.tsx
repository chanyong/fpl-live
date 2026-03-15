import { LeagueSearchForm } from "@/components/league-search-form";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-12">
      <section className="rounded-[2rem] border border-[var(--border)] bg-[var(--surface)]/95 p-8 shadow-[0_20px_80px_rgba(55,40,20,0.12)]">
        <p className="text-sm uppercase tracking-[0.3em] text-[var(--muted)]">
          Official FPL live dashboard
        </p>
        <h1 className="mt-4 max-w-3xl text-5xl font-semibold leading-tight">
          Track a classic mini-league as matches unfold.
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-8 text-[var(--muted)]">
          Enter a public FPL classic league ID to see provisional gameweek points,
          projected rank changes, and each squad&apos;s current live status.
        </p>
        <LeagueSearchForm />
      </section>
    </main>
  );
}
