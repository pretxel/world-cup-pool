import type { MatchStage } from "@/lib/db";
import { cn } from "@/lib/utils";

export function StageIcon({
  stage,
  className,
}: {
  stage: string;
  className?: string;
}) {
  const cls = cn("size-4 shrink-0", className);
  switch (stage as MatchStage) {
    case "group":
      // Three group dots.
      return (
        <svg
          viewBox="0 0 16 16"
          aria-hidden="true"
          className={cls}
          fill="currentColor"
        >
          <circle cx="3" cy="8" r="1.8" />
          <circle cx="8" cy="8" r="1.8" />
          <circle cx="13" cy="8" r="1.8" />
        </svg>
      );
    case "r32":
      // Compact bracket — many small forks.
      return (
        <svg
          viewBox="0 0 16 16"
          aria-hidden="true"
          className={cls}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        >
          <path d="M2 3h2v3h3M2 7h2v3h3M2 11h2v2h3M10 8h3M11 5h3v3M11 11h3v-3" />
        </svg>
      );
    case "r16":
      // 4-way bracket.
      return (
        <svg
          viewBox="0 0 16 16"
          aria-hidden="true"
          className={cls}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        >
          <path d="M2 4h2v3h3M2 12h2v-3h3M14 4h-2v3h-3M14 12h-2v-3h-3M7 7h2M7 9h2" />
        </svg>
      );
    case "qf":
      // 2-way bracket converging.
      return (
        <svg
          viewBox="0 0 16 16"
          aria-hidden="true"
          className={cls}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        >
          <path d="M2 4h3v4h3M2 12h3v-4M14 4h-3v4h-3M14 12h-3v-4" />
        </svg>
      );
    case "sf":
      // Semi: two paths joining into one.
      return (
        <svg
          viewBox="0 0 16 16"
          aria-hidden="true"
          className={cls}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        >
          <path d="M2 4h4v4M2 12h4v-4M6 8h8" />
        </svg>
      );
    case "third":
      // Bronze medal.
      return (
        <svg
          viewBox="0 0 16 16"
          aria-hidden="true"
          className={cls}
          fill="currentColor"
        >
          <path d="M5 1.5l-2 4 5 .7L5 1.5zM11 1.5l-3 4.7 5-.7-2-4z" opacity="0.55" />
          <circle cx="8" cy="11" r="4" />
          <text
            x="8"
            y="13"
            textAnchor="middle"
            fontSize="5"
            fontWeight="700"
            fill="currentColor"
            style={{ fill: "var(--background, white)" }}
          >
            3
          </text>
        </svg>
      );
    case "final":
      // Trophy.
      return (
        <svg
          viewBox="0 0 16 16"
          aria-hidden="true"
          className={cls}
          fill="currentColor"
        >
          <path d="M4 2h8v1.5c0 .8.2 1.5 1.4 1.5h.6V3h-1.5V2H4v1H2.5v2H3c1.2 0 1.4-.7 1.4-1.5V2zM5 2v3a3 3 0 0 0 6 0V2H5zM7 9h2v2.5h1.5V13h-5v-1.5H7V9z" />
        </svg>
      );
    default:
      return (
        <svg
          viewBox="0 0 16 16"
          aria-hidden="true"
          className={cls}
          fill="currentColor"
        >
          <circle cx="8" cy="8" r="2" />
        </svg>
      );
  }
}
