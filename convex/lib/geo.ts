const EARTH_RADIUS_MILES = 3958.8;

export function haversineMiles(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_MILES * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Issue 007: 1 + (maxDistance - distance) / maxDistance, capped at 1.5 */
export function proximityMultiplier(
  distanceMiles: number,
  maxDistanceMiles: number,
): number {
  if (maxDistanceMiles <= 0) return 1;
  const raw = 1 + (maxDistanceMiles - distanceMiles) / maxDistanceMiles;
  return Math.min(1.5, Math.max(0.5, raw));
}
