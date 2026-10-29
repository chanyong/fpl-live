import { OG_SIZE, renderOgCard } from "@/lib/og-card";

export const alt = "FPL Live — FPL 미니리그 실시간 순위와 가격 변동 예측";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function OpengraphImage() {
  return renderOgCard({
    eyebrow: "FPL Live",
    title: "미니리그 순위, 실시간으로",
    subtitle: "잠정 점수 · 순위 변화 · 보너스 예상 · 가격 변동 예측",
    chip: "무료 · 로그인 없음 · 한국어/English"
  }, {
    eyebrow: "FPL Live",
    title: "Your mini-league, live.",
    subtitle: "Standings · Rank swings · Bonus · Price predictions",
    chip: "Free · No login · KO / EN"
  });
}
