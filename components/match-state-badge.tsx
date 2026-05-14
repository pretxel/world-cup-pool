import { LockIcon, CircleDotIcon, FlagIcon, CalendarClockIcon, BanIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Status = "scheduled" | "live" | "final" | "cancelled" | "locked";

const palette: Record<Status, string> = {
  scheduled:
    "bg-secondary text-secondary-foreground ring-1 ring-inset ring-border",
  locked:
    "bg-muted text-muted-foreground ring-1 ring-inset ring-border",
  live:
    "bg-destructive/10 text-destructive ring-1 ring-inset ring-destructive/30 dark:bg-destructive/20",
  final:
    "bg-pitch text-pitch-foreground ring-1 ring-inset ring-pitch/50",
  cancelled:
    "bg-muted text-muted-foreground line-through ring-1 ring-inset ring-border",
};

const label: Record<Status, string> = {
  scheduled: "Open",
  locked: "Locked",
  live: "Live",
  final: "Final",
  cancelled: "Cancelled",
};

export function MatchStateBadge({
  status,
  className,
  size = "default",
}: {
  status: Status;
  className?: string;
  size?: "default" | "sm";
}) {
  const Icon =
    status === "live"
      ? CircleDotIcon
      : status === "final"
        ? FlagIcon
        : status === "locked"
          ? LockIcon
          : status === "cancelled"
            ? BanIcon
            : CalendarClockIcon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md font-mono font-medium uppercase tracking-[0.14em]",
        size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[11px]",
        palette[status],
        status === "live" && "live-pulse",
        className,
      )}
    >
      {status !== "live" ? (
        <Icon className={size === "sm" ? "size-3" : "size-3.5"} aria-hidden />
      ) : null}
      <span>{label[status]}</span>
    </span>
  );
}
