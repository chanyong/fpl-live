import { ImageResponse } from "next/og";
import { loadKoreanFont } from "@/lib/og-font";

export const OG_SIZE = { width: 1200, height: 630 };

type Card = { eyebrow: string; title: string; subtitle: string; chip: string };

/** The 1200×630 share card used site-wide; Hangul renders when the font subset loads, else the English copy. */
export async function renderOgCard(ko: Card, en: Card) {
  const font = await loadKoreanFont(`${ko.eyebrow}${ko.title}${ko.subtitle}${ko.chip}`);
  const { eyebrow, title, subtitle, chip } = font ? ko : en;
  // Hangul is about twice as wide as Latin; fit the title on one or two lines within 1040px.
  const width = [...title].reduce((sum, ch) => sum + (/[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]/.test(ch) ? 1 : 0.58), 0);
  const titleSize = Math.max(52, Math.min(84, Math.floor(1040 / Math.max(width, 1)), width > 24 ? 64 : 84));

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 80,
          background: "#f4f1ea",
          color: "#1d1b18",
          fontFamily: font ? "NotoKR" : undefined
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: "#0b6e4f",
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 36,
              fontWeight: 800
            }}
          >
            F
          </div>
          <div style={{ fontSize: 34, color: "#0b6e4f", fontWeight: 800 }}>{eyebrow}</div>
        </div>
        <div style={{ fontSize: titleSize, fontWeight: 800, lineHeight: 1.12, marginTop: 28, display: "flex", wordBreak: "keep-all" }}>{title}</div>
        <div style={{ fontSize: 36, color: "#6b6558", marginTop: 24, display: "flex" }}>{subtitle}</div>
        <div style={{ display: "flex", marginTop: 44 }}>
          <div style={{ background: "#ddf5ea", color: "#084d38", padding: "12px 28px", borderRadius: 999, fontSize: 30, fontWeight: 800 }}>
            {chip}
          </div>
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      fonts: font ? [{ name: "NotoKR", data: font, weight: 800, style: "normal" }] : undefined,
      headers: { "Cache-Control": "public, max-age=600, s-maxage=600" }
    }
  );
}
