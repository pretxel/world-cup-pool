import { cn } from "@/lib/utils";

export function TrophyMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 80"
      aria-hidden="true"
      className={cn("h-auto w-full", className)}
      fill="none"
    >
      <defs>
        <linearGradient id="tm-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--flag, 45 96% 64%))" />
          <stop offset="60%" stopColor="hsl(var(--flag, 38 92% 55%))" />
          <stop offset="100%" stopColor="hsl(var(--flag, 30 85% 42%))" />
        </linearGradient>
        <linearGradient id="tm-rim" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.15" />
          <stop offset="50%" stopColor="currentColor" stopOpacity="0.65" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.15" />
        </linearGradient>
      </defs>

      {/* Side handles */}
      <path
        d="M14 18 C 6 18, 4 28, 10 36 C 14 40, 18 40, 20 38"
        stroke="url(#tm-gold)"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M50 18 C 58 18, 60 28, 54 36 C 50 40, 46 40, 44 38"
        stroke="url(#tm-gold)"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />

      {/* Cup body */}
      <path
        d="M16 12 H48 V32 C 48 44, 40 50, 32 50 C 24 50, 16 44, 16 32 Z"
        fill="url(#tm-gold)"
      />
      {/* Rim shine */}
      <rect x="16" y="12" width="32" height="4" fill="url(#tm-rim)" />
      {/* Highlight stripe */}
      <path
        d="M21 18 C 22 30, 25 38, 30 44"
        stroke="currentColor"
        strokeOpacity="0.18"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />

      {/* Stem */}
      <rect x="29" y="50" width="6" height="8" fill="url(#tm-gold)" />
      {/* Base */}
      <rect x="20" y="58" width="24" height="4" rx="1" fill="url(#tm-gold)" />
      <rect x="16" y="62" width="32" height="6" rx="2" fill="url(#tm-gold)" />

      {/* Star */}
      <path
        d="M32 22 l1.7 3.6 4 .4 -3 2.7 .8 3.9 -3.5 -2 -3.5 2 .8 -3.9 -3 -2.7 4 -.4 z"
        fill="currentColor"
        fillOpacity="0.35"
      />
    </svg>
  );
}
