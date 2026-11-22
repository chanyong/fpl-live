import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();

  return [
    { url: base, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/price-changes`, changeFrequency: "hourly", priority: 0.9 },
    // League-free pages (issue #33 stage 2). Individual mini-league pages stay out: thin and one per league.
    { url: `${base}/premier-league`, changeFrequency: "hourly", priority: 0.8 },
    { url: `${base}/fixtures`, changeFrequency: "hourly", priority: 0.8 },
    { url: `${base}/players`, changeFrequency: "hourly", priority: 0.8 },
    { url: `${base}/faq`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/terms`, changeFrequency: "yearly", priority: 0.2 }
  ];
}
