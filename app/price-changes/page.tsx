import type { Metadata } from "next";
import { PriceChangesPage } from "@/components/price-changes-page";

const TITLE = "FPL 가격 변동 예측 — 오늘 오를 선수·내릴 선수 | FPL Live";
const DESCRIPTION =
  "FPL 공식 가격 변동 진행률로 다음 갱신(한국 시각 오전 9시경)에 오를 선수와 내릴 선수를 확인하세요. 최근 실제 가격 변동 기록과 다음 갱신까지 남은 시간도 리그 ID 없이 볼 수 있습니다.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/price-changes" },
  openGraph: { type: "website", siteName: "FPL Live", locale: "ko_KR", title: TITLE, description: DESCRIPTION, url: "/price-changes", images: [{ url: "/opengraph-image", width: 1200, height: 630 }] },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: ["/opengraph-image"] }
};

export default function PriceChangesRoute() {
  return <PriceChangesPage />;
}
