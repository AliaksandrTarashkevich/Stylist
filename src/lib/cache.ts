import { createHash } from "crypto";

/**
 * Generate a cache key for a try-on combination.
 * Same reference photo + same set of clothing items = same key.
 * Clothing IDs are sorted so order doesn't matter.
 */
export function generateCacheKey(
  referencePhotoId: string,
  clothingItemIds: string[],
  imageCountSuffix?: string
): string {
  const sorted = [...clothingItemIds].sort().join(",");
  const input = imageCountSuffix
    ? `${referencePhotoId}:${sorted}:${imageCountSuffix}`
    : `${referencePhotoId}:${sorted}`;
  return createHash("sha256").update(input).digest("hex").slice(0, 16);
}
