import type { Locale } from "@/lib/locale";
import { formatMoney } from "@/lib/season-summary";
import type { EntrySquadPayload } from "@/lib/squad-types";
import type { XpPlayer, XpTable } from "@/lib/xp/model";
import type { TransferSearchResult } from "@/lib/xp/transfer-search";

/**
 * Issue #69: the rules-based "why this player" for every player a Wildcard or Free Hit scenario brings in.
 * Pure and free: every figure is read from the xP table that already produced the scenario, so the text can
 * never disagree with the swap list or the expected points shown beside it.
 */

export type ChipPickFixture = { opponent: string; home: boolean; difficulty: number };

export type ChipPick = {
  id: number;
  position: string;
  teamShortName: string;
  /** Tenths of a million (current price). */
  cost: number;
  /** xP of the target gameweek, and the discounted sum over the horizon (the same figure the search used). */
  xpNext: number;
  xpPeriod: number;
  fixtures: ChipPickFixture[];
  /** The leaving player of the same position this one stands in for (null when none is left to pair). */
  replacesId: number | null;
  replacesXpNext: number | null;
  replacesXpPeriod: number | null;
  replacesCost: number | null;
  /** C / V when the pick is the captain / vice-captain of the scenario's recommended XI. */
  role: "C" | "V" | null;
  /** True when the pick is in the scenario's recommended XI (false: bench). */
  starter: boolean;
};

export type ChipExplanation = {
  mode: "wildcard" | "freehit";
  /** Gameweeks the period figures sum (3 or 5, fewer at the end of the season). */
  horizon: number;
  /** The gameweek the scenario is for. */
  targetGw: number;
  picks: ChipPick[];
};

const POSITION_BY_TYPE: Record<number, string> = { 1: "GKP", 2: "DEF", 3: "MID", 4: "FWD" };
export const POSITION_ORDER = ["GKP", "DEF", "MID", "FWD"];

function periodOf(row: XpPlayer | undefined, horizon: number) {
  if (!row) return 0;
  return horizon >= 5 ? row.sum5 : row.sum3;
}

export function buildChipExplanations(
  squad: Pick<EntrySquadPayload, "squad">,
  transfers: TransferSearchResult | null,
  table: XpTable,
  lineups: Record<string, { starters: number[]; captainId: number | null; viceCaptainId: number | null }>,
  cards: Record<string, { teamShortName: string }> = {}
): Record<string, ChipExplanation> {
  const out: Record<string, ChipExplanation> = {};
  if (!transfers) return out;
  const own = new Map(squad.squad.map((player) => [player.elementId, player]));
  const horizon = transfers.horizon;
  const positionOf = (id: number) => own.get(id)?.position ?? POSITION_BY_TYPE[table.players.get(id)?.elementType ?? 3] ?? "MID";

  for (const scenario of transfers.scenarios) {
    if (scenario.type !== "wildcard" && scenario.type !== "freehit") continue;
    const lineup = lineups[scenario.id];
    const starters = new Set(lineup?.starters ?? []);
    const free = [...scenario.out];
    const picks: ChipPick[] = scenario.in.map((id) => {
      const row = table.players.get(id);
      const position = positionOf(id);
      // Pair with a leaving player of the same position, best xP first, so the "instead of" is the closest like-for-like.
      let at = -1;
      let bestXp = -Infinity;
      free.forEach((outId, index) => {
        const outXp = table.players.get(outId)?.next ?? 0;
        if (positionOf(outId) === position && outXp > bestXp) {
          bestXp = outXp;
          at = index;
        }
      });
      const replacesId = at >= 0 ? free.splice(at, 1)[0] : null;
      const replaced = replacesId !== null ? table.players.get(replacesId) : undefined;
      return {
        id,
        position,
        teamShortName: own.get(id)?.teamShortName ?? cards[String(id)]?.teamShortName ?? "-",
        cost: row?.nowCost ?? 0,
        xpNext: row?.next ?? 0,
        xpPeriod: periodOf(row, horizon),
        fixtures: (row?.weeks[0]?.games ?? []).map((game) => ({ opponent: game.opponent, home: game.home, difficulty: game.difficulty })),
        replacesId,
        replacesXpNext: replaced ? replaced.next : null,
        replacesXpPeriod: replaced ? periodOf(replaced, horizon) : null,
        replacesCost: replaced ? replaced.nowCost : null,
        role: lineup?.captainId === id ? "C" : lineup?.viceCaptainId === id ? "V" : null,
        starter: starters.has(id)
      };
    });
    picks.sort((a, b) => POSITION_ORDER.indexOf(a.position) - POSITION_ORDER.indexOf(b.position) || b.xpNext - a.xpNext);
    out[scenario.id] = { mode: scenario.type, horizon, targetGw: table.targetGw, picks };
  }
  return out;
}

const fmt = (value: number) => value.toFixed(1);
const signed = (value: number) => `${value >= 0 ? "+" : "-"}${Math.abs(value).toFixed(1)}`;

function difficultyWord(fixtures: ChipPickFixture[], locale: Locale) {
  if (fixtures.length === 0) return locale === "en" ? "no game" : "경기 없음";
  const avg = fixtures.reduce((sum, fixture) => sum + fixture.difficulty, 0) / fixtures.length;
  if (locale === "en") return avg <= 2 ? "easy" : avg >= 4 ? "hard" : "average";
  return avg <= 2 ? "쉬움" : avg >= 4 ? "어려움" : "보통";
}

/**
 * One line per pick. Free Hit: this week only (next-GW xP leads). Wildcard: the 3 / 5 GW period leads.
 * `names` gives the display names (the picks carry IDs only).
 */
export function chipPickReason(
  pick: ChipPick,
  mode: ChipExplanation["mode"],
  horizon: number,
  locale: Locale,
  names: (id: number) => string
): string {
  const en = locale === "en";
  const fixtures = pick.fixtures.map((fixture) => `${fixture.opponent} ${fixture.home ? "H" : "A"}`).join(", ");
  const opponent = en
    ? `${difficultyWord(pick.fixtures, locale)}${fixtures ? ` (${fixtures})` : ""}`
    : `상대 ${difficultyWord(pick.fixtures, locale)}${fixtures ? `(${fixtures})` : ""}`;
  const lead =
    mode === "freehit"
      ? en
        ? `this week xP ${fmt(pick.xpNext)}`
        : `이번 주 기대 ${fmt(pick.xpNext)}`
      : en
        ? `next ${horizon} GW xP ${fmt(pick.xpPeriod)} (next GW ${fmt(pick.xpNext)})`
        : `다음 ${horizon}GW 기대 ${fmt(pick.xpPeriod)}(다음 GW ${fmt(pick.xpNext)})`;
  const parts = [lead, opponent];
  if (pick.replacesId !== null && pick.replacesXpNext !== null && pick.replacesXpPeriod !== null && pick.replacesCost !== null) {
    const diff = mode === "freehit" ? pick.xpNext - pick.replacesXpNext : pick.xpPeriod - pick.replacesXpPeriod;
    const money = pick.cost - pick.replacesCost;
    const cost = money === 0 ? "" : ` (${money > 0 ? "+" : "-"}${formatMoney(Math.abs(money))})`;
    parts.push(
      en
        ? `instead of ${names(pick.replacesId)}: ${signed(diff)}${cost}`
        : `${names(pick.replacesId)} 대신 ${signed(diff)}${cost}`
    );
  }
  if (pick.role) parts.push(pick.role === "C" ? (en ? "captain pick" : "캡틴 후보") : en ? "vice-captain pick" : "부주장 후보");
  return parts.join(" · ");
}

/** The sentence about what the chip means for the period, shown above the picks. */
export function chipModeNote(mode: ChipExplanation["mode"], horizon: number, locale: Locale): string {
  if (locale === "en") {
    return mode === "freehit"
      ? "Free Hit: this week only. Picks are judged on next-GW xP; the squad returns to what it was the week after."
      : `Wildcard: the squad stays. Picks are judged on the next ${horizon} GW, not only this week.`;
  }
  return mode === "freehit"
    ? "프리 힛은 이번 주만 적용됩니다. 다음 GW 기대 점수를 중심으로 골랐고, 다음 주에는 원래 팀으로 돌아옵니다."
    : `와일드카드는 팀이 그대로 남습니다. 이번 주만이 아니라 다음 ${horizon}GW 기대 점수를 기준으로 골랐습니다.`;
}
