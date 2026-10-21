import type { Metadata } from "next";
import { PriceChangesPage } from "@/components/price-changes-page";

export const metadata: Metadata = {
  title: "FPL Price Change Predictions · FPL 가격 변동 예측",
  description:
    "Live FPL price rise and fall predictions with filters for progress, projection and outlook. FPL 가격 변동 예측을 리그 ID 없이 바로 확인하세요.",
  alternates: { canonical: "/price-changes" }
};

export default function PriceChangesRoute() {
  return <PriceChangesPage />;
}
