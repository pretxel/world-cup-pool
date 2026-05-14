import { ImageResponse } from "next/og";

export const alt = "World Cup 2026 Pool — predict every match";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background:
            "radial-gradient(circle at 20% 10%, #1f2937 0%, #0a0a0a 60%)",
          color: "#fafafa",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            fontSize: 28,
            color: "#a3a3a3",
            letterSpacing: 6,
            textTransform: "uppercase",
          }}
        >
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: 9999,
              background: "#22c55e",
            }}
          />
          WC26 Pool
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              fontSize: 108,
              fontWeight: 800,
              lineHeight: 1.02,
              letterSpacing: -3,
            }}
          >
            World Cup 2026 Pool
          </div>
          <div
            style={{
              fontSize: 40,
              color: "#d4d4d4",
              maxWidth: 900,
              lineHeight: 1.25,
            }}
          >
            Predict every match. Climb the daily leaderboard.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 26,
            color: "#a3a3a3",
          }}
        >
          <div style={{ display: "flex", gap: 32 }}>
            <span>Daily scoring</span>
            <span>Live standings</span>
            <span>Locks at kickoff</span>
          </div>
          <div style={{ color: "#fafafa", fontWeight: 600 }}>2026</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
