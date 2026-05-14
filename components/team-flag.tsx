import { flagSlug } from "@/lib/team-flag";
import { cn } from "@/lib/utils";

type Size = "sm" | "md" | "lg";

const SIZE: Record<Size, { w: number; h: number; rounded: string }> = {
  sm: { w: 20, h: 15, rounded: "rounded-[2px]" },
  md: { w: 28, h: 21, rounded: "rounded-[3px]" },
  lg: { w: 56, h: 42, rounded: "rounded-[4px]" },
};

export function TeamFlag({
  team,
  size = "sm",
  className,
}: {
  team: string;
  size?: Size;
  className?: string;
}) {
  const slug = flagSlug(team);
  const { w, h, rounded } = SIZE[size];

  if (!slug) {
    return (
      <span
        aria-hidden="true"
        className={cn(
          "inline-flex shrink-0 items-center justify-center bg-muted text-[10px] font-semibold text-muted-foreground ring-1 ring-border",
          rounded,
          className,
        )}
        style={{ width: w, height: h }}
      >
        ?
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/flags/${slug}.svg`}
      alt={`${team} flag`}
      width={w}
      height={h}
      loading="lazy"
      decoding="async"
      className={cn(
        "inline-block shrink-0 object-cover ring-1 ring-black/10 dark:ring-white/10",
        rounded,
        className,
      )}
    />
  );
}
