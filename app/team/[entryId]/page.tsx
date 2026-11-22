import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SquadPage } from "@/components/squad-page";
import { parseEntryId } from "@/lib/request-params";

type Props = { params: Promise<{ entryId: string }> };

// A personal team screen: one thin page per team ID, so it stays out of search results (and the sitemap and
// robots.txt, see app/sitemap.ts and app/robots.ts). Issue #39 stage 2.
export const metadata: Metadata = {
  title: "내 스쿼드 보기 | FPL Live",
  robots: { index: false, follow: false }
};

export default async function TeamRoute({ params }: Props) {
  const { entryId } = await params;
  const parsed = parseEntryId(entryId);
  if ("error" in parsed) {
    notFound();
  }

  return <SquadPage entryId={parsed.entryId} />;
}
