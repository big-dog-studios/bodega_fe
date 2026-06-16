/** Shared MapLibre config used by the store map and the location picker. */

/** OpenFreeMap "liberty" vector style (free, no key). */
export const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

/** NYC five-boroughs bounding box — the map can't pan/zoom out of the city. */
export const NYC_BOUNDS: [[number, number], [number, number]] = [
  [-74.2591, 40.4774], // SW
  [-73.7004, 40.9176], // NE
];

/** Don't let the user zoom out past the city. */
export const MIN_ZOOM = 10;

/** Default map center (Midtown-ish) when we have no better location. */
export const NYC_CENTER = { longitude: -73.9857, latitude: 40.7484 };
