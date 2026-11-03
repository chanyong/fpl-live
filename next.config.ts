import type { NextConfig } from "next";
import { SECURITY_HEADERS } from "./lib/security-headers";

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: [...SECURITY_HEADERS] }];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "resources.premierleague.com"
      }
    ]
  }
};

export default nextConfig;
