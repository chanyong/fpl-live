import type { Metadata } from "next";

/**
 * The pages that belong to no mini-league (issue #33 stage 2): one place for each page's address, menu
 * label, title and description, so the metadata, the menu and the sitemap cannot drift apart.
 */
export type PublicPageKey = "premier-league" | "fixtures" | "players" | "price-changes";

export type PublicPage = {
  path: string;
  /** Top-menu label, Korean and English. */
  label: { ko: string; en: string };
  title: string;
  description: string;
};

export const PUBLIC_PAGES: Record<PublicPageKey, PublicPage> = {
  "premier-league": {
    path: "/premier-league",
    label: { ko: "EPL 순위표", en: "EPL table" },
    title: "프리미어리그 순위표 — 승점·득실차·최근 5경기 | FPL Live",
    description:
      "프리미어리그 20개 팀의 현재 순위와 승점, 득실차, 최근 5경기 흐름을 확인하세요. 진행 중인 경기는 현재 스코어까지 반영합니다."
  },
  fixtures: {
    path: "/fixtures",
    label: { ko: "경기 일정", en: "Fixtures" },
    title: "프리미어리그 경기 일정·결과와 팀별 일정 난이도 | FPL Live",
    description:
      "이번 게임위크와 다음 두 게임위크의 프리미어리그 경기 일정과 결과, 팀별 향후 7경기 FPL 난이도를 리그 ID 없이 확인하세요."
  },
  players: {
    path: "/players",
    label: { ko: "선수 통계", en: "Players" },
    title: "FPL 선수 통계 — 폼·득점·영입 추이·차별화 선수 | FPL Live",
    description:
      "FPL 선수들의 시즌 점수와 폼, 이번 주 영입·방출 추이, 소유율이 낮은 차별화 후보를 포지션별로 확인하세요. 공식 FPL 데이터를 씁니다."
  },
  "price-changes": {
    path: "/price-changes",
    label: { ko: "가격 변동", en: "Price changes" },
    title: "FPL 가격 변동 예측 — 오늘 오를 선수·내릴 선수 | FPL Live",
    description:
      "FPL 공식 가격 변동 진행률로 다음 갱신(한국 시각 오전 9시경)에 오를 선수와 내릴 선수를 확인하세요. 최근 실제 가격 변동 기록과 다음 갱신까지 남은 시간도 리그 ID 없이 볼 수 있습니다."
  }
};

/** Top-menu order. */
export const PUBLIC_MENU: PublicPageKey[] = ["premier-league", "fixtures", "players", "price-changes"];

/**
 * Title, description, canonical and share card for one public page. The share image is named here on
 * purpose: setting `openGraph` in a page replaces the file-based /opengraph-image, so leaving `images`
 * out would drop it from shared links.
 */
export function publicPageMetadata(key: PublicPageKey): Metadata {
  const { path, title, description } = PUBLIC_PAGES[key];
  const images = [{ url: "/opengraph-image", width: 1200, height: 630, alt: "FPL Live" }];

  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { type: "website", siteName: "FPL Live", locale: "ko_KR", title, description, url: path, images },
    twitter: { card: "summary_large_image", title, description, images }
  };
}
