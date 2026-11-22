import type { Locale } from "@/lib/locale";

/**
 * Screen wording for the recommendation panel on /team/[id] (issue #43, stage 4). The server sends codes
 * (assumption codes, chip reasons, limit reasons); the sentences live here so both languages stay in one place.
 * Nothing in this file comes from a model.
 */

type Pair = { ko: string; en: string };
const pick = (pair: Pair, locale: Locale) => (locale === "en" ? pair.en : pair.ko);

const ASSUMPTIONS: Record<string, Pair> = {
  squad_last_deadline: {
    ko: "스쿼드는 지난 마감 때의 팀입니다. 그 뒤에 한 이적·선발·캡틴 변경은 보이지 않습니다.",
    en: "The squad is the one at the last passed deadline; transfers, lineup and captain changes made since are not seen."
  },
  xp1_rules: {
    ko: "기대 점수(xP)는 최근 성적(폼·경기당 점수), 선발 비율, 상대 난이도, 홈/원정만 반영한 단순 추정이며 예측이 아닙니다.",
    en: "Expected points use form, points per game, start ratio, fixture difficulty and home/away only; they are estimates, not forecasts."
  },
  chance_next_gw_only: {
    ko: "FPL의 출전 가능성 수치는 다음 게임위크에만 적용하고, 그 뒤 주는 선발 비율로 계산합니다.",
    en: "FPL's chance of playing applies to the next gameweek only; later weeks use the start ratio."
  },
  transfer_prices_estimated: {
    ko: "판매가와 무료 이적 수는 추정값입니다(FPL은 로그인한 본인에게만 실제 수치를 보여 줍니다). 마지막 마감 뒤에 한 이적은 보이지 않습니다.",
    en: "Selling prices and free transfers are estimates (FPL shows the real figures only to the logged-in manager); transfers made since the last deadline are not seen."
  },
  transfer_pool_search: {
    ko: "이적 시나리오는 포지션별 약 30명의 후보 풀 안에서 찾은 결과입니다. 모든 선수를 보지는 않으며, 와일드카드·프리 힛은 근사 탐색이라 최선이 아닐 수 있습니다.",
    en: "Transfer scenarios search a pool of about 30 candidates per position, not every player. Wildcard and Free Hit are a greedy search and not guaranteed best."
  },
  weight_not_probability: {
    ko: "캡틴 추천 비중은 다섯 명 사이의 상대 비중이며, 최고 득점을 할 확률이 아닙니다.",
    en: "The captain weight is a relative recommendation among five players, not the probability of the top score."
  }
};

/** An unknown code (a newer server) falls back to the server's own English text. */
export function assumptionText(code: string, fallback: string, locale: Locale) {
  const pair = ASSUMPTIONS[code];
  return pair ? pick(pair, locale) : fallback;
}

const CHIP_REASONS: Record<string, Pair> = {
  chip_not_in_season: { ko: "이 시즌에는 쓸 수 없는 칩입니다.", en: "This chip is not part of this season." },
  chip_used: { ko: "이 기간의 칩을 이미 썼습니다.", en: "This half's chip has already been used." },
  chip_not_open: { ko: "아직 쓸 수 있는 기간이 아닙니다.", en: "Not open yet." },
  chip_expired: { ko: "쓸 수 있는 기간이 지났습니다.", en: "The window has passed." }
};

export function chipReasonText(code: string, locale: Locale) {
  const pair = CHIP_REASONS[code];
  return pair ? pick(pair, locale) : pick({ ko: "지금은 쓸 수 없습니다.", en: "Not available now." }, locale);
}

export const LIMIT_TEXT: Record<"day" | "month" | "regen", Pair> = {
  day: {
    ko: "오늘의 AI 분석 한도에 도달했습니다. 내일 다시 시도해 주세요.",
    en: "Today's AI analysis limit has been reached. Try again tomorrow."
  },
  month: {
    ko: "이번 달 AI 분석 한도에 도달했습니다. 다음 달에 다시 쓸 수 있습니다.",
    en: "This month's AI analysis limit has been reached. It opens again next month."
  },
  regen: {
    ko: "이번 GW에 다시 분석할 수 있는 횟수를 모두 썼습니다.",
    en: "All re-analyses for this gameweek have been used."
  }
};

export function limitText(reason: string, locale: Locale) {
  const pair = LIMIT_TEXT[reason as keyof typeof LIMIT_TEXT] ?? LIMIT_TEXT.day;
  return pick(pair, locale);
}
