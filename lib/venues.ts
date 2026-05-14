// Manifest of venues that have a photo at /public/venues/<slug>.jpg.
// Drop a JPG into public/venues/ and add its slug here to light up the photo.
export const VENUE_PHOTOS: Set<string> = new Set<string>([
  // e.g. "sofi-stadium", "estadio-azteca"
]);

export function venueSlug(venue: string | null | undefined): string | null {
  if (!venue) return null;
  const stadium = venue.split(",")[0]?.trim();
  if (!stadium) return null;
  return stadium
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
