import type { Metadata } from "next";
import { TeamEntryPage } from "@/components/team-entry-page";

export const metadata: Metadata = {
  title: "내 스쿼드 보기 | FPL Live",
  robots: { index: false, follow: false }
};

export default function TeamIndexRoute() {
  return <TeamEntryPage />;
}
