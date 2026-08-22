import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import { QueryProvider } from "@/components/query-provider";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans"
});

export const metadata: Metadata = {
  title: "FPL Live 미니리그",
  description: "공식 FPL 데이터로 보는 클래식 미니리그 라이브 대시보드."
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" className={manrope.variable}>
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
