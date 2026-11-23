"use client";

import type { ReactNode } from "react";
import { useLocale } from "@/components/locale-provider";
import { chipLabel } from "@/lib/chips";
import type { ChipStatus } from "@/lib/chip-availability";
import { transferCost } from "@/lib/free-transfers";
import { formatMoney } from "@/lib/season-summary";
import type { EntrySquadPayload } from "@/lib/squad-types";

function Stat({ label, value, hint, estimate }: { label: string; value: ReactNode; hint?: string; estimate?: boolean }) {
  const { tr } = useLocale();
  return (
    <div className="min-w-0 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
      <div className="flex items-center gap-1.5 text-caption text-[var(--muted)]">
        <span>{label}</span>
        {estimate ? (
          <span className="rounded-sm bg-[var(--surface-strong)] px-1 text-caption font-semibold text-[var(--muted)]">
            {tr("추정", "est.")}
          </span>
        ) : null}
      </div>
      <div className="text-title font-semibold leading-snug tabular-nums">{value}</div>
      {hint ? <div className="text-caption leading-4 text-[var(--muted)]">{hint}</div> : null}
    </div>
  );
}

function useChipState(chip: ChipStatus) {
  const { tr } = useLocale();
  const state = chip.state;
  if (state.kind === "used") {
    return { text: tr(`GW${state.event} 사용`, `Used GW${state.event}`), tone: "bg-[var(--surface-strong)] text-[var(--muted)]" };
  }
  if (state.kind === "available") {
    return { text: tr("사용 가능", "Available"), tone: "bg-[var(--accent-soft)] text-[var(--accent-ink)]" };
  }
  if (state.kind === "later") {
    return { text: tr(`GW${state.startEvent}부터`, `From GW${state.startEvent}`), tone: "bg-[var(--surface-strong)] text-[var(--muted)]" };
  }
  return { text: tr("기간 종료", "Expired"), tone: "bg-[var(--surface-strong)] text-[var(--muted)]" };
}

function ChipRow({ chip }: { chip: ChipStatus }) {
  const { tr } = useLocale();
  const { text, tone } = useChipState(chip);
  const half = chip.startEvent < 20 ? tr("전반", "1st half") : tr("후반", "2nd half");
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="min-w-0 truncate text-caption text-[var(--muted)]">
        {half} · GW{chip.startEvent}–{chip.stopEvent}
      </span>
      <span className={`shrink-0 rounded-sm px-1.5 py-0.5 text-caption font-semibold ${tone}`}>{text}</span>
    </div>
  );
}

/** One card per chip with its first-half and second-half grants on two lines (issue #64). */
function ChipCard({ name, chips }: { name: string; chips: ChipStatus[] }) {
  const { locale } = useLocale();
  return (
    <li className="flex min-w-0 flex-col gap-1 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5">
      <div className="truncate text-meta font-semibold">{chipLabel(name, false, locale)}</div>
      {chips.map((chip) => (
        <ChipRow key={`${chip.name}-${chip.startEvent}`} chip={chip} />
      ))}
    </li>
  );
}

/** Bank, free transfers, transfer cost, squad value and the eight chips of the season. */
export function SquadStatusBar({ data, className = "" }: { data: EntrySquadPayload; className?: string }) {
  const { tr } = useLocale();
  const t = data.transfers;
  const nextGw = data.nextGw;
  const chipMap = new Map<string, ChipStatus[]>();
  for (const chip of data.chips) {
    chipMap.set(chip.name, [...(chipMap.get(chip.name) ?? []), chip]);
  }
  const chipGroups = [...chipMap.entries()];

  return (
    <section aria-label={tr("팀 현황", "Team status")} className={`flex min-w-0 flex-col gap-2 ${className}`}>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-1">
        <Stat label={tr("은행 잔액", "Bank")} value={formatMoney(data.bank)} />
        <Stat
          label={tr("무료 이적", "Free transfers")}
          estimate
          value={t.freeTransfers === null ? "-" : tr(`${t.freeTransfers}개`, String(t.freeTransfers))}
          hint={
            t.freeTransfers === null
              ? undefined
              : nextGw !== null
                ? tr(`GW${nextGw} 기준`, `For GW${nextGw}`)
                : undefined
          }
        />
        <Stat
          label={tr("지난 GW 이적", "Last GW transfers")}
          value={t.lastGwCost > 0 ? `−${t.lastGwCost}${tr("점", " pts")}` : tr("비용 없음", "No cost")}
          hint={tr(`${t.lastGwTransfers}명 이적`, `${t.lastGwTransfers} made`)}
        />
        <Stat
          label={tr("선수단 가치", "Squad value")}
          value={formatMoney(data.squadValue)}
          hint={
            data.squadSellingValue !== null
              ? tr(`판매가 기준 ${formatMoney(data.squadSellingValue)}(추정)`, `${formatMoney(data.squadSellingValue)} at selling prices (est.)`)
              : undefined
          }
        />
      </div>

      {t.pendingTransfers > 0 ? (
        <p role="status" className="rounded-md border border-[var(--info-border)] bg-[var(--info-soft)] px-3 py-2 text-meta">
          {tr(
            `FPL 공개 목록에 다음 GW 이적이 ${t.pendingTransfers}건 보입니다. 위 스쿼드에는 아직 반영되지 않았습니다.`,
            `FPL's public list shows ${t.pendingTransfers} transfer(s) for the next gameweek. The squad above does not include them yet.`
          )}
          {t.freeTransfers !== null
            ? tr(
                ` 무료 이적 ${t.freeTransfers}개 기준 예상 비용 ${transferCost(t.pendingTransfers, t.freeTransfers)}점(추정).`,
                ` Estimated cost with ${t.freeTransfers} free: ${transferCost(t.pendingTransfers, t.freeTransfers)} pts.`
              )
            : null}
        </p>
      ) : null}

      <div>
        <h2 className="mb-1.5 text-body font-semibold">{tr("칩 현황", "Chips")}</h2>
        <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-1">
          {chipGroups.map(([name, chips]) => (
            <ChipCard key={name} name={name} chips={chips} />
          ))}
        </ul>
      </div>
    </section>
  );
}
