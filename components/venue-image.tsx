import Image from "next/image";
import { VENUE_PHOTOS, venueSlug } from "@/lib/venues";
import { cn } from "@/lib/utils";

export function VenueImage({
  venue,
  className,
}: {
  venue: string | null | undefined;
  className?: string;
}) {
  const slug = venueSlug(venue);
  if (!slug || !VENUE_PHOTOS.has(slug)) return null;

  return (
    <Image
      src={`/venues/${slug}.jpg`}
      alt={venue ?? ""}
      fill
      sizes="(min-width: 1024px) 768px, 100vw"
      priority={false}
      className={cn("object-cover", className)}
    />
  );
}
