import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: ["/", "/price-changes"], // Personal team screens (issue #39 stage 2): one thin page per team ID, kept out of crawls.
    disallow: ["/api/", "/team/"] },
    sitemap: `${siteUrl()}/sitemap.xml`
  };
}
