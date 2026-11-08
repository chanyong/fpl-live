import type { Metadata } from "next";
import { PrivacyContent } from "@/components/legal-pages";

const TITLE = "개인정보처리방침 | FPL Live";
const DESCRIPTION =
  "FPL Live 개인정보처리방침: 가입 없이 쓰는 대시보드와 선택 가입 일지 기능: Google Analytics 이용 통계, 의견·질문 버튼 내용, 일지 회원의 이메일·FPL 팀 번호를 처리합니다. 쿠키 거부 방법과 문의처를 안내합니다.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/privacy" },
  openGraph: { type: "website", siteName: "FPL Live", locale: "ko_KR", title: TITLE, description: DESCRIPTION, url: "/privacy", images: [{ url: "/opengraph-image", width: 1200, height: 630 }] }
};

export default function PrivacyPage() {
  return <PrivacyContent />;
}
