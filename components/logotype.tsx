import { cn } from "@/lib/utils";

type Size = "xs" | "md" | "xl";

// Geometry constants tuned for the viewBox 0 0 240 64.
// Full form: WC | (pitch stripe) | (green tile with 26) | · Pool
// Compact form (xs): drops the · Pool suffix and tightens viewBox to 0 0 168 64.

const FULL_VIEWBOX = "0 0 240 64";
const COMPACT_VIEWBOX = "0 0 168 64";

const PIXEL_HEIGHT: Record<Size, number> = {
  xs: 22,
  md: 44,
  xl: 96,
};

export function Logotype({
  size = "md",
  className,
  ariaLabel,
}: {
  size?: Size;
  className?: string;
  ariaLabel?: string;
}) {
  const compact = size === "xs";
  const viewBox = compact ? COMPACT_VIEWBOX : FULL_VIEWBOX;
  const heightPx = PIXEL_HEIGHT[size];
  const widthPx = compact ? heightPx * (168 / 64) : heightPx * (240 / 64);

  return (
    <svg
      role={ariaLabel ? "img" : undefined}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
      viewBox={viewBox}
      width={widthPx}
      height={heightPx}
      preserveAspectRatio="xMidYMid meet"
      className={cn("shrink-0 align-middle text-foreground", className)}
    >
      {/* WC — bold condensed glyphs drawn as paths for crisp render at every size */}
      <g fill="currentColor">
        {/* W */}
        <path d="M4 12 H14 L19 44 L24 18 H32 L37 44 L42 12 H52 L42 56 H32 L28 30 L24 56 H14 Z" />
        {/* C */}
        <path d="M86 33 C 86 19, 75 11, 62 11 C 50 11, 40 19, 40 33 C 40 47, 50 55, 62 55 C 73 55, 82 49, 84 39 H 73 C 72 44, 67 47, 62 47 C 55 47, 50 41, 50 33 C 50 25, 55 19, 62 19 C 67 19, 71 22, 73 27 H 84 C 84 25, 85 21, 86 19 Z" />
      </g>

      {/* Pitch-stripe rule between WC and the 26 tile */}
      <g>
        <rect
          x="92"
          y="14"
          width="3"
          height="36"
          rx="1.5"
          fill="currentColor"
          opacity="0.22"
        />
      </g>

      {/* 26 tile: pitch-green rounded square with bold mono numerals */}
      <g>
        <rect
          x="102"
          y="8"
          width="56"
          height="48"
          rx="10"
          style={{ fill: "var(--pitch)" }}
        />
        {/* Subtle inner highlight (pitch-stripe motif) */}
        <rect
          x="102"
          y="8"
          width="56"
          height="16"
          rx="10"
          fill="white"
          fillOpacity="0.08"
        />
        <text
          x="130"
          y="42"
          textAnchor="middle"
          fontFamily="'JetBrains Mono', ui-monospace, SFMono-Regular, monospace"
          fontWeight="800"
          fontSize="28"
          letterSpacing="-1"
          style={{ fill: "var(--pitch-foreground)" }}
        >
          26
        </text>
      </g>

      {compact ? null : (
        <g>
          {/* divider dot */}
          <circle cx="170" cy="32" r="2" fill="currentColor" opacity="0.5" />
          {/* Pool suffix in mono */}
          <text
            x="180"
            y="40"
            fontFamily="'JetBrains Mono', ui-monospace, SFMono-Regular, monospace"
            fontWeight="600"
            fontSize="18"
            letterSpacing="3"
            fill="currentColor"
          >
            POOL
          </text>
        </g>
      )}
    </svg>
  );
}
