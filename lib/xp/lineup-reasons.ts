import type { Locale } from "@/lib/locale";
import { formatMoney } from "@/lib/season-summary";
import type { LineupPlayerCard, ScenarioLineup } from "@/lib/xp/recommend";

/**
 * Issue #83: the rules-based "why this player starts / sits on the bench / wears the armband" for one scenario
 * lineup. Pure and free (no AI call): every number is read from the same cards that draw the pitch, so a line can
 * never disagree with the expected points shown on the card.
 */

export type LineupReasonKind = "starter" | "bench" | "captain" | "vice" | "in";
export type LineupReason = { id: number; kind: LineupReasonKind; position: string; text: string };

/** What the IN line needs about the player a signing replaces (the search does not say who replaces whom; the screen pairs by position). */
export type LineupMove = { inId: number; outName: string; outXp: number | null; outCost: number | null; inCost: number | null };

export const POSITION_ORDER = ["GKP", "DEF", "MID", "FWD"] as const;

const fmt = (value: number) => value.toFixed(1);
const signed = (value: number) => `${value >= 0 ? "+" : "-"}${Math.abs(value).toFixed(1)}`;

function nextGame(card: LineupPlayerCard, en: boolean): string {
  const game = card.fixtures[0];
  if (!game) return en ? "no game" : "경기 없음";
  const more = card.fixtures.length > 1 ? (en ? ` +${card.fixtures.length - 1}` : ` 외 ${card.fixtures.length - 1}경기`) : "";
  return `${game.opponent}(${game.home ? "H" : "A"}) FDR ${game.difficulty}${more}`;
}

/** Reasons for every player of the lineup, in pitch order (starters then bench), then the IN lines. */
export function buildLineupReasons(
  lineup: ScenarioLineup,
  cards: Record<string, LineupPlayerCard>,
  locale: Locale,
  moves: LineupMove[] = []
): LineupReason[] {
  const en = locale === "en";
  const card = (id: number): LineupPlayerCard | undefined => cards[String(id)];
  const xp = (id: number) => card(id)?.xpNext ?? 0;
  const name = (id: number) => card(id)?.webName ?? `#${id}`;
  const pos = (id: number) => card(id)?.position ?? "MID";
  const all = [...lineup.starters, ...lineup.bench];
  // Rank among everyone of the same position in the 15 (1 = highest xP; ties keep the pitch order).
  const rank = (id: number) => {
    const same = all.filter((other) => pos(other) === pos(id)).sort((a, b) => xp(b) - xp(a));
    return same.indexOf(id) + 1;
  };
  const slots = (position: string) => lineup.starters.filter((id) => pos(id) === position).length;
  const squadOf = (position: string) => all.filter((id) => pos(id) === position).length;
  const benchedBest = (position: string) => lineup.bench.filter((id) => pos(id) === position).sort((a, b) => xp(b) - xp(a))[0];
  const startedLowest = (position: string) => lineup.starters.filter((id) => pos(id) === position).sort((a, b) => xp(a) - xp(b))[0];

  const out: LineupReason[] = [];

  for (const id of lineup.starters) {
    const c = card(id);
    if (!c) continue;
    const position = pos(id);
    const n = slots(position);
    const rival = benchedBest(position);
    const vsRival =
      rival !== undefined
        ? en
          ? `, ${fmt(xp(id) - xp(rival))} above bench ${name(rival)}`
          : `, 벤치 ${name(rival)}보다 ${fmt(xp(id) - xp(rival))} 높음`
        : "";
    out.push({
      id,
      kind: "starter",
      position,
      text: en
        ? `${name(id)} starts: ${n} ${position} slot${n > 1 ? "s" : ""} in ${lineup.formation}, xP ${fmt(xp(id))} (#${rank(id)} of ${squadOf(position)} ${position})${vsRival}, ${nextGame(c, en)}`
        : `${name(id)} 선발 — ${position} ${n}자리 중 기대 ${fmt(xp(id))}(${squadOf(position)}명 중 ${rank(id)}위)${vsRival}, ${nextGame(c, en)}`
    });
  }

  lineup.bench.forEach((id, index) => {
    const c = card(id);
    if (!c) return;
    const position = pos(id);
    const isKeeper = position === "GKP";
    const n = slots(position);
    const weakest = startedLowest(position);
    // A bench player who out-scores a starter of another position lost the place to the formation, not to form.
    const outfieldStarters = lineup.starters.filter((s) => pos(s) !== "GKP");
    const lowestOutfield = outfieldStarters.length > 0 ? Math.min(...outfieldStarters.map(xp)) : 0;
    const formationBound = !isKeeper && xp(id) > lowestOutfield;
    let why: string;
    if (isKeeper) {
      why = en ? `second goalkeeper, xP ${fmt(xp(id))}, covers only if the starter cannot play` : `후보 골키퍼 기대 ${fmt(xp(id))}, 선발 GK가 못 뛸 때만 들어옴`;
    } else if (formationBound) {
      why = en
        ? `xP ${fmt(xp(id))} but the ${n} ${position} slots of ${lineup.formation} are full (weakest starter ${fmt(weakest ? xp(weakest) : 0)}), ${nextGame(c, en)}`
        : `기대 ${fmt(xp(id))}지만 포메이션 ${lineup.formation}의 ${position} ${n}자리가 이미 참(선발 최저 ${fmt(weakest ? xp(weakest) : 0)}), ${nextGame(c, en)}`;
    } else {
      why = en
        ? `#${rank(id)} of ${squadOf(position)} ${position}, xP ${fmt(xp(id))} below the ${n} starters, ${nextGame(c, en)}`
        : `${position} ${squadOf(position)}명 중 ${rank(id)}위 기대 ${fmt(xp(id))}(선발 ${n}명보다 낮음), ${nextGame(c, en)}`;
    }
    const order = isKeeper
      ? ""
      : index === 1
        ? en
          ? ". First in when a starter drops out"
          : ". 선발이 빠지면 가장 먼저 들어옴"
        : en
          ? `. Comes in number ${index} on the bench`
          : `. 교체 순서 ${index}번째`;
    out.push({ id, kind: "bench", position, text: en ? `${name(id)} bench ${index}: ${why}${order}` : `${name(id)} 벤치 ${index} — ${why}${order}` });
  });

  const armband = (id: number | null, kind: "captain" | "vice") => {
    if (id === null || !card(id)) return;
    const c = card(id)!;
    const ranked = [...lineup.starters].sort((a, b) => xp(b) - xp(a));
    const place = ranked.indexOf(id) + 1;
    const label = kind === "captain" ? (en ? "Captain" : "캡틴") : en ? "Vice-captain" : "부캡틴";
    out.push({
      id,
      kind,
      position: pos(id),
      text: en
        ? `${label} ${name(id)}: xP ${fmt(xp(id))} (#${place} in the XI), ${nextGame(c, en)}${kind === "captain" ? " — scores double" : " — takes over if the captain does not play"}`
        : `${label} ${name(id)} — 선발 중 기대 ${fmt(xp(id))}(${place}위), ${nextGame(c, en)}${kind === "captain" ? ". 점수 2배" : ". 캡틴이 못 뛰면 대신 2배"}`
    });
  };
  armband(lineup.captainId, "captain");
  armband(lineup.viceCaptainId, "vice");

  for (const move of moves) {
    if (!card(move.inId)) continue;
    const parts: string[] = [];
    if (move.outXp !== null) parts.push(en ? `xP ${signed(xp(move.inId) - move.outXp)} vs ${move.outName}` : `${move.outName} 대비 기대 ${signed(xp(move.inId) - move.outXp)}`);
    else parts.push(en ? `instead of ${move.outName}` : `${move.outName} 대신`);
    if (move.inCost !== null && move.outCost !== null) {
      const money = move.inCost - move.outCost;
      parts.push(money === 0 ? (en ? "same price" : "가격 같음") : `${money > 0 ? "+" : "-"}${formatMoney(Math.abs(money))}`);
    } else if (move.inCost !== null) {
      parts.push(en ? `price ${formatMoney(move.inCost)}` : `가격 ${formatMoney(move.inCost)}`);
    }
    out.push({ id: move.inId, kind: "in", position: pos(move.inId), text: `${name(move.inId)} IN — ${parts.join(", ")}` });
  }
  return out;
}

/** The short one-line note for a pitch card tooltip. */
export function reasonByPlayer(reasons: LineupReason[]): Record<number, string> {
  const map: Record<number, string> = {};
  for (const reason of reasons) {
    if (reason.kind === "starter" || reason.kind === "bench") map[reason.id] = reason.text;
  }
  return map;
}
