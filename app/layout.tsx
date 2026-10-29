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

const TITLE = "FPL Live — FPL 미니리그 실시간 순위·가격 변동 예측";
const DESCRIPTION =
  "FPL(판타지 프리미어리그) 미니리그의 잠정 점수와 실시간 순위, BPS 보너스 예상, 라이벌 점수 차, 선수 가격 변동 예측을 로그인 없이 무료로 보는 한국어 대시보드.";

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
    "FPL 가격 변동",
    "FPL 보너스 포인트 예상"
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "FPL Live",
    title: TITLE,
    description: DESCRIPTION,
    url: "/",
    locale: "ko_KR",
    alternateLocale: ["en_US"]
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
  verification: { google: "xvAnUUfmT3__qox3MlY5TFmG735TP1rwejDi5cOrmHA" }
};

const PLAUSIBLE_DOMAIN = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
const GA_ID = process.env.NEXT_PUBLIC_GA_ID || "G-QBEEY5TCB6";

const STRUCTURED_DATA = [
  {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "FPL Live",
    url: siteUrl(),
    applicationCategory: "SportsApplication",
    operatingSystem: "Any",
    inLanguage: ["ko", "en"],
    description: DESCRIPTION,
    offers: { "@type": "Offer", price: "0", priceCurrency: "KRW" }
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "FPL Live",
    url: siteUrl(),
    inLanguage: ["ko", "en"],
    publisher: { "@type": "Organization", name: "FPL Live" }
  },
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "FPL Live",
    url: siteUrl(),
    logo: `${siteUrl()}/icon.png`,
    founder: { "@type": "Person", name: "chanyong" },
    email: "cyjung@gmail.com"
  }
];

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
        {/* 운영자 사이트 공통 의견·질문 버튼(딸깍랭크 의견함). 한/영 전환 시 <html lang> 을 따라 언어가 바뀐다 */}
        <script src="https://ddalkkakrank.kr/feedback.js" defer data-color="#0b6e4f" />
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
