import type { Metadata } from "next";
import { TermsContent } from "@/components/legal-pages";

const TITLE = "이용약관 | FPL Live";
const DESCRIPTION =
  "FPL Live 이용약관: 비공식 무료 FPL 팬 서비스의 제공 범위, 잠정 점수·보너스 예상·가격 변동 예측의 한계, 이용 시 지켜야 할 점과 문의처를 안내합니다.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/terms" },
  openGraph: { type: "website", siteName: "FPL Live", locale: "ko_KR", title: TITLE, description: DESCRIPTION, url: "/terms", images: [{ url: "/opengraph-image", width: 1200, height: 630 }] }
};

export default function TermsPage() {
  return <TermsContent />;
}
