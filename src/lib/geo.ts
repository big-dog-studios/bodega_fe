/** Geo math for "how far / how long to walk" hints. */

const EARTH_RADIUS_MI = 3958.8;
// Average walking pace; ~3.1 mph (5 km/h) is the standard pedestrian-routing speed.
const WALK_MPH = 3.1;

const toRad = (deg: number): number => (deg * Math.PI) / 180;

/** Great-circle distance between two lat/lon points, in miles (haversine). */
export function distanceMiles(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_MI * 2 * Math.asin(Math.sqrt(h));
}

/** Walking time in whole minutes for a straight-line distance (min 1 min). */
export function walkMinutes(miles: number): number {
  return Math.max(1, Math.round((miles / WALK_MPH) * 60));
}
