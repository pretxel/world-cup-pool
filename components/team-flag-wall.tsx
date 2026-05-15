import { TEAM_FLAG } from "@/lib/team-flag";
import { cn } from "@/lib/utils";

const TEAMS = Object.keys(TEAM_FLAG);

export function TeamFlagWall({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "grid grid-cols-8 gap-1.5 sm:grid-cols-12 sm:gap-2",
        className,
      )}
    >
      {TEAMS.map((team) => {
        const slug = TEAM_FLAG[team];
        return (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={team}
            src={`/flags/${slug}.svg`}
            alt=""
            loading="lazy"
            decoding="async"
            className="aspect-[4/3] w-full rounded-sm object-cover ring-1 ring-black/5 dark:ring-white/5"
          />
        );
      })}
    </div>
  );
}
