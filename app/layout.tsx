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
  title: "FPL Live Mini-League",
  description: "Live classic mini-league dashboard using official FPL data."
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={manrope.variable}>
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
