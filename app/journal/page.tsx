import type { Metadata } from "next";
import { JournalPage } from "@/components/journal-page";

export const metadata: Metadata = {
  title: "주간 경기 리뷰 일지 | FPL Live",
  description: "내 FPL 팀의 주간 점수와 경기 결과를 자동으로 저장하고, 평가와 계획을 적는 개인 일지.",
  alternates: { canonical: "/journal" },
  robots: { index: false, follow: false }
};

export default function Page() {
  return <JournalPage />;
}
