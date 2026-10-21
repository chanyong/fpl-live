import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import { LocaleProvider } from "@/components/locale-provider";
import { QueryProvider } from "@/components/query-provider";
import { SiteFooter } from "@/components/site-footer";
import { siteUrl } from "@/lib/site";
import Script from "next/script";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans"
});

const TITLE = "FPL Live — Mini-league live standings & price changes · FPL 미니리그 라이브";
const DESCRIPTION =
  "Follow your FPL mini-league live: provisional points, rank swings, transfer market and price change predictions. Free, no login. 공식 FPL 데이터로 보는 미니리그 라이브 순위와 가격 변동 예측.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: TITLE, template: "%s" },
  description: DESCRIPTION,
  keywords: [
    "FPL",
    "Fantasy Premier League",
    "FPL mini league",
    "FPL live",
    "FPL price changes",
    "FPL 미니리그",
    "FPL 가격 변동"
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "FPL Live",
    title: TITLE,
    description: DESCRIPTION,
    url: "/",
    locale: "en_US",
    alternateLocale: ["ko_KR"]
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION }
};

const PLAUSIBLE_DOMAIN = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "FPL Live",
  applicationCategory: "SportsApplication",
  operatingSystem: "Any",
  inLanguage: ["en", "ko"],
  description: DESCRIPTION,
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" }
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" className={manrope.variable}>
      <body>
        <LocaleProvider>
          <QueryProvider>{children}</QueryProvider>
          <SiteFooter />
        </LocaleProvider>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }} />
        {PLAUSIBLE_DOMAIN ? (
          <Script defer data-domain={PLAUSIBLE_DOMAIN} src="https://plausible.io/js/script.js" strategy="afterInteractive" />
        ) : null}
        {GA_ID ? (
          <>
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
            <Script id="ga-init" strategy="afterInteractive">
              {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${GA_ID}');`}
            </Script>
          </>
        ) : null}
      </body>
    </html>
  );
}
