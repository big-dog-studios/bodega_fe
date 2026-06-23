/**
 * Browse-to-cache for the basemap. MapLibre pulls the style, glyphs, sprites and
 * vector tiles from a remote host (see `mapConfig.MAP_STYLE`); none of that is
 * offline-able on its own. This routes those requests through a custom MapLibre
 * protocol that reads/writes the Cache API: the first time you view an area it's
 * fetched and stored, and every later view (online or off) is served from cache.
 *
 * Only areas/zooms you've actually looked at are cached — never-visited tiles
 * stay blank offline. That's the deliberate trade vs. bundling a full NYC pack.
 *
 * Works in the Capacitor webview and the browser without a service worker, so it
 * doesn't depend on iOS WKWebView's spotty SW support. Pairs with the map via
 * react-map-gl's `transformRequest` (see StoreMap).
 */
import type { RequestParameters, ResourceType } from 'maplibre-gl';

/** Bump the suffix to invalidate everything if the basemap style changes. */
const CACHE_NAME = 'map-basemap-v1';
const PROTOCOL = 'mapcache';
const PREFIX = `${PROTOCOL}://`;

/** Resource types that make up the basemap — the only ones we intercept. */
const CACHEABLE = new Set<string>([
  'Style',
  'Source',
  'Tile',
  'Glyphs',
  'SpriteImage',
  'SpriteJSON',
]);

let registered = false;

/**
 * Register the caching protocol. Call once before the map mounts. No-op where
 * the Cache API is unavailable (then `transformRequest` is bypassed too, so the
 * map just fetches normally).
 */
export async function registerMapCache(): Promise<void> {
  if (registered || typeof caches === 'undefined') return;
  registered = true;

  // Imported lazily so this module stays free of maplibre's top-level side
  // effects (e.g. URL.createObjectURL), which break in jsdom under test.
  const { addProtocol } = await import('maplibre-gl');

  addProtocol(PROTOCOL, async (params: RequestParameters, abort: AbortController) => {
    const url = params.url.slice(PREFIX.length); // strip our scheme → real https URL
    const cache = await caches.open(CACHE_NAME);

    let res = await cache.match(url);
    if (!res) {
      res = await fetch(url, { signal: abort.signal });
      // Only persist complete, successful responses — never cache an error/partial.
      if (res.ok) await cache.put(url, res.clone());
    }

    // Hand MapLibre the body in the shape it asked for (tiles/glyphs = bytes).
    switch (params.type) {
      case 'json':
        return { data: await res.json() };
      case 'string':
        return { data: await res.text() };
      default:
        return { data: await res.arrayBuffer() };
    }
  });
}

/**
 * react-map-gl `transformRequest`: send basemap assets through the caching
 * protocol, leave everything else untouched (return undefined = default fetch).
 */
export function mapCacheTransform(
  url: string,
  resourceType?: ResourceType,
): RequestParameters | undefined {
  if (typeof caches === 'undefined') return undefined;
  if (resourceType && CACHEABLE.has(resourceType) && /^https?:\/\//.test(url)) {
    return { url: `${PREFIX}${url}` };
  }
  return undefined;
}
