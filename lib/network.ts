// 운영자의 다른 서비스(하단 상호 링크) 공통 데이터. 11개 사이트가 같은 목록을 쓰고, 현재 사이트만 뺀다.
// 공통 사양: chanyong/ddalkkak-rank#12. 순서 = 분야순(여행 → 금융·생활 → 그 밖).
// group 은 화면에 표시하지 않고 순서 기준으로만 쓴다. en·descEn 은 이 사이트의 영어 토글용.
export const NETWORK_UTM = { source: "fpl", medium: "footer_network" } as const; // source = 이 사이트의 브랜드 key

export type NetworkSite = {
  url: string;
  name: string;
  en: string;
  desc: string;
  descEn: string;
  icon: string;
  group: "travel" | "life" | "etc";
};

export const ALL_NETWORK_SITES: NetworkSite[] = [
  { url: "https://www.airmoa.kr", name: "에어모아", en: "Airmoa", desc: "항공권 특가 모음", descEn: "Airfare deals", icon: "✈️", group: "travel" },
  { url: "https://zoommytrip.kr", name: "내여행 찾아줌", en: "ZoomMyTrip", desc: "마일리지 좌석", descEn: "Award seats", icon: "🧳", group: "travel" },
  { url: "https://ittaeda.com", name: "이때다", en: "Ittaeda", desc: "호텔 날짜별 가격", descEn: "Hotel prices by date", icon: "🏨", group: "travel" },
  { url: "https://supgaja.com", name: "숲가자", en: "Supgaja", desc: "자연휴양림 빈자리", descEn: "Forest lodge vacancies", icon: "🌲", group: "travel" },
  { url: "https://etfx.kr", name: "ETFX", en: "ETFX", desc: "ETF 구성종목 분석", descEn: "ETF holdings", icon: "📊", group: "life" },
  { url: "https://cardmatch.kr", name: "카드매치", en: "CardMatch", desc: "카드 추천", descEn: "Card picker", icon: "💳", group: "life" },
  { url: "https://myapgujeong.kr", name: "내 압구정", en: "My Apgujeong", desc: "아파트 실거래", descEn: "Apartment deals", icon: "🏢", group: "life" },
  { url: "https://auto-insu-compare.vercel.app", name: "자동차보험 환급 비교", en: "Car insurance compare", desc: "보험료 비교", descEn: "Premium comparison", icon: "🚗", group: "life" },
  { url: "https://www.ipsion.kr", name: "입시on", en: "Ipsion", desc: "대입 경쟁률", descEn: "Admission rates", icon: "🎓", group: "etc" },
  { url: "https://fpl-live-production-34f4.up.railway.app", name: "FPL Live", en: "FPL Live", desc: "판타지 프리미어리그", descEn: "Fantasy Premier League", icon: "⚽", group: "etc" },
  { url: "https://ddalkkakrank.kr", name: "딸깍랭크", en: "DdalkkakRank", desc: "AI 서비스 랭킹", descEn: "AI service ranking", icon: "🏆", group: "etc" }
];

// 현재 사이트 자신은 주소 비교로 뺀다. 도메인을 바꾸면 위 목록의 FPL Live 주소와 함께 바꾼다.
export const SELF_URL = "https://fpl-live-production-34f4.up.railway.app";

export const NETWORK_SITES: NetworkSite[] = ALL_NETWORK_SITES.filter((site) => site.url !== SELF_URL);

/** 상호 링크 주소. URL API로 붙여서 주소에 이미 ? 가 있으면 & 로 이어진다. */
export function networkHref(url: string): string {
  const target = new URL(url);
  target.searchParams.set("utm_source", NETWORK_UTM.source);
  target.searchParams.set("utm_medium", NETWORK_UTM.medium);
  return target.toString();
}
