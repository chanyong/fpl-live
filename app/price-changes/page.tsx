import type { Metadata } from "next";
import { PriceChangesPage } from "@/components/price-changes-page";
import { publicPageMetadata } from "@/lib/public-pages";

export const metadata: Metadata = publicPageMetadata("price-changes");

export default function PriceChangesRoute() {
  return <PriceChangesPage />;
}
