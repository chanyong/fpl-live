import { ImageResponse } from "next/og";

export const alt = "FPL Live — your mini-league, live";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Latin only: the default OG font has no Hangul glyphs.
export default function OpengraphImage() {
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
          color: "#1d1b18"
        }}
      >
        <div style={{ fontSize: 34, color: "#0b6e4f", fontWeight: 700 }}>FPL LIVE</div>
        <div style={{ fontSize: 84, fontWeight: 800, lineHeight: 1.05, marginTop: 20 }}>
          Your mini-league, live.
        </div>
        <div style={{ fontSize: 36, color: "#6b6558", marginTop: 28 }}>
          Standings · Rank swings · Price change predictions
        </div>
        <div style={{ display: "flex", marginTop: 48 }}>
          <div style={{ background: "#ddf5ea", color: "#084d38", padding: "12px 28px", borderRadius: 999, fontSize: 30, fontWeight: 700 }}>
            Free · No login · KO / EN
          </div>
        </div>
      </div>
    ),
    size
  );
}
