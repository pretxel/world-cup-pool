import { ImageResponse } from "next/og";

export const alt = "World Cup 2026 Pool — predict every match";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const PITCH = "#16a34a";
const PITCH_FG = "#f8fafc";
const FOREGROUND = "#fafafa";
const MUTED = "#9ca3af";

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
            "radial-gradient(circle at 18% 12%, #1f2937 0%, #0a0a0a 60%)",
          color: FOREGROUND,
          fontFamily: "sans-serif",
        }}
      >
        {/* Wordmark — top left */}
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <span
            style={{
              fontSize: 96,
              fontWeight: 900,
              letterSpacing: -4,
              lineHeight: 1,
              color: FOREGROUND,
            }}
          >
            WC
          </span>
          <span
            style={{
              width: 6,
              height: 70,
              borderRadius: 3,
              background: FOREGROUND,
              opacity: 0.22,
            }}
          />
          <span
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 132,
              height: 96,
              borderRadius: 22,
              background: PITCH,
              color: PITCH_FG,
              fontSize: 64,
              fontWeight: 900,
              letterSpacing: -2,
              fontFamily: "ui-monospace, SFMono-Regular, monospace",
            }}
          >
            26
          </span>
          <span
            style={{
              marginLeft: 20,
              fontSize: 32,
              letterSpacing: 8,
              color: MUTED,
              textTransform: "uppercase",
              fontFamily: "ui-monospace, SFMono-Regular, monospace",
            }}
          >
            · Pool
          </span>
        </div>

        {/* Headline */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div
            style={{
              fontSize: 92,
              fontWeight: 800,
              lineHeight: 1.02,
              letterSpacing: -3,
              color: FOREGROUND,
            }}
          >
            Predict every match.
          </div>
          <div
            style={{
              fontSize: 36,
              color: "#d4d4d4",
              maxWidth: 900,
              lineHeight: 1.25,
            }}
          >
            Submit exact-score picks. Lock at kickoff. Climb the global leaderboard.
          </div>
        </div>

        {/* Bottom row: pitch-stripe band + 2026 stamp */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 24,
            color: MUTED,
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 8,
            }}
          >
            {Array.from({ length: 8 }).map((_, i) => (
              <span
                key={i}
                style={{
                  width: 28,
                  height: 8,
                  borderRadius: 4,
                  background: i % 2 === 0 ? PITCH : "#374151",
                  opacity: 0.7,
                }}
              />
            ))}
          </div>
          <span
            style={{
              color: FOREGROUND,
              fontWeight: 800,
              fontSize: 40,
              letterSpacing: -1,
              fontFamily: "ui-monospace, SFMono-Regular, monospace",
            }}
          >
            2026
          </span>
        </div>
      </div>
    ),
    { ...size },
  );
}
