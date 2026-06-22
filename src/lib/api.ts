/**
 * Thin client over the Map API. See CLAUDE.md "API contract".
 * IMPORTANT axis order: the API bbox is lon-first — [west, south, east, north].
 *
 * Data shapes live in `./types`; this module is only the HTTP calls.
 */
import type {
  Bbox,
  Report,
  ReverseAddress,
  Store,
  StoreFilters,
  StorePin,
  StoreProducts,
} from './types';

/** Base URL of the Map API — one config value (CLAUDE.md), never inline at the call. */
const API_BASE_URL: string = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080').replace(
  /\/+$/,
  '',
);

/** Gateway API key, sent as `x-api-key` on every request to our API. */
const API_KEY: string | undefined = import.meta.env.VITE_API_KEY;

/** Headers required on every gateway request (merged with any per-call extras). */
function apiHeaders(extra?: Record<string, string>): Record<string, string> {
  return { ...(API_KEY ? { 'x-api-key': API_KEY } : {}), ...extra };
}

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, { signal, headers: apiHeaders() });
  if (!res.ok) {
    throw new Error(`API ${res.status} for ${path}`);
  }
  return res.json() as Promise<T>;
}

/** Fetch pins within the viewport bbox, optionally narrowed by feature filters. */
export function getStores(
  bbox: Bbox,
  filters?: StoreFilters,
  signal?: AbortSignal,
): Promise<StorePin[]> {
  const params = new URLSearchParams({ bbox: bbox.join(',') });
  for (const [key, value] of Object.entries(filters ?? {})) {
    if (value !== undefined) params.set(key, String(value));
  }
  return getJson<StorePin[]>(`/stores?${params}`, signal);
}

/** Fetch one store's full record by license number. */
export function getStore(licenseNumber: string, signal?: AbortSignal): Promise<Store> {
  return getJson<Store>(`/stores/${encodeURIComponent(licenseNumber)}`, signal);
}

/** Fetch a store's product catalog by license number. */
export function getStoreProducts(
  licenseNumber: string,
  signal?: AbortSignal,
): Promise<StoreProducts> {
  return getJson<StoreProducts>(`/stores/${encodeURIComponent(licenseNumber)}/products`, signal);
}

/** Submit a crowd-sourced report (or a new bodega) as multipart form data. */
export async function submitReport(report: Report, signal?: AbortSignal): Promise<void> {
  const form = new FormData();
  form.set('mode', report.mode);
  if (report.license_number) form.set('license_number', report.license_number);
  if (report.name.trim()) form.set('name', report.name.trim());
  if (report.address.trim()) form.set('address', report.address.trim());
  if (report.house?.trim()) form.set('house', report.house.trim());
  if (report.street?.trim()) form.set('street', report.street.trim());
  if (report.city?.trim()) form.set('city', report.city.trim());
  if (report.zip?.trim()) form.set('zip', report.zip.trim());
  if (report.lat != null) form.set('lat', String(report.lat));
  if (report.lon != null) form.set('lon', String(report.lon));
  for (const [field, value] of Object.entries(report.answers)) {
    form.set(field, value);
  }
  if (report.hours?.trim()) form.set('hours', report.hours.trim());
  if (report.user_id) form.set('user_id', report.user_id);
  if (report.receipt) form.set('receipt', report.receipt);
  for (const photo of report.photos ?? []) form.append('photos', photo);

  const res = await fetch(`${API_BASE_URL}/submissions`, {
    method: 'POST',
    body: form,
    signal,
    headers: apiHeaders(),
  });
  if (!res.ok) {
    throw new Error(`API ${res.status} for /submissions`);
  }
}

/** Single-line string built from the structured parts (empty parts dropped). */
export function formatReverseAddress(a: ReverseAddress): string {
  const street = [a.house, a.street].filter(Boolean).join(' ');
  return [street, a.city, a.zip].filter(Boolean).join(', ');
}

/**
 * Reverse-geocode a coordinate to structured address parts (house, street, city,
 * zip) via Nominatim. Used by the map location picker so a tapped point yields a
 * fillable address. Returns null if nothing matches. Low-volume usage only.
 */
export async function reverseGeocode(
  lat: number,
  lon: number,
  signal?: AbortSignal,
): Promise<ReverseAddress | null> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`;
  const res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!res.ok) {
    throw new Error(`Reverse geocode ${res.status}`);
  }
  const data = (await res.json()) as { address?: Record<string, string> };
  const a = data.address;
  if (!a) return null;
  return {
    house: a.house_number ?? '',
    street: a.road ?? '',
    city: a.city || a.town || a.village || a.suburb || a.neighbourhood || '',
    zip: a.postcode ?? '',
  };
}
