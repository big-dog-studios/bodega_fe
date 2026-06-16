/**
 * Thin client over the Map API. See CLAUDE.md "API contract".
 * IMPORTANT axis order: the API bbox is lon-first — [west, south, east, north].
 */

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

/** Feature flags present on both the list and detail responses. */
export interface StoreFeatureFlags {
  has_snap: boolean;
  has_tobacco: boolean;
  has_lottery: boolean;
  has_quick_draw: boolean;
  has_prepared_food: boolean;
}

/** Pin from `GET /stores?bbox=...` — coords + flags + alcohol class. */
export interface StorePin extends StoreFeatureFlags {
  license_number: string;
  dba: string;
  lat: number;
  lon: number;
  /** Alcohol class code; null = no alcohol license. */
  alc_class: number | null;
}

/** Full record from `GET /stores/{license_number}` — pin fields + identity/address + alcohol detail. */
export interface StoreDetail extends StorePin {
  entity: string;
  house: string;
  street: string;
  city: string;
  county: string;
  zip: string;
  estab_type: string;
  alc_description: string | null;
  alc_product: string | null;
  has_atm: boolean;
  has_cat: boolean;
  /** Google Places enrichment — null when the store hasn't been matched/enriched. */
  place_id: string | null;
  display_name: string | null;
  phone: string | null;
  rating: number | null;
  user_rating_count: number | null;
  accepts_credit_cards: boolean | null;
  accepts_debit_cards: boolean | null;
  accepts_cash_only: boolean | null;
  accepts_nfc: boolean | null;
  takeout: boolean | null;
  delivery: boolean | null;
  hours_summary: string | null;
}

/** A geographic bbox in API order: west, south, east, north (lon/lat). */
export type Bbox = readonly [west: number, south: number, east: number, north: number];

/**
 * Server-side filters for `GET /stores`. Each provided flag is sent as a query
 * param (e.g. `has_lottery=true`); omitted flags don't constrain the result.
 * Note `has_alcohol` is the filter param even though the row field is `alc_class`.
 */
export interface StoreFilters {
  has_snap?: boolean;
  has_tobacco?: boolean;
  has_lottery?: boolean;
  has_quick_draw?: boolean;
  has_prepared_food?: boolean;
  has_alcohol?: boolean;
  has_cat?: boolean;
  has_atm?: boolean;
  takeout?: boolean;
  delivery?: boolean;
  /** Only stores with at least one catalog item. */
  has_products?: boolean;
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
export function getStore(licenseNumber: string, signal?: AbortSignal): Promise<StoreDetail> {
  return getJson<StoreDetail>(`/stores/${encodeURIComponent(licenseNumber)}`, signal);
}

/** A single catalog item from `GET /stores/{license_number}/products`. */
export interface StoreProduct {
  product_id: number;
  name: string;
  description: string | null;
  /** Price in cents; pair with `price_raw` for the pre-formatted string. */
  price_cents: number;
  price_raw: string;
  /** Where the item was scraped from, e.g. "doordash". */
  source: string;
  /** Granular type within a category, e.g. "sandwich", "soda". */
  subtype: string;
  subtype_label: string;
  category_slug: string;
  category_label: string;
  category_emoji: string;
  /** Original menu section name from the source, e.g. "Cold Sandwiches". */
  source_category: string;
}

/** A category bucket from the products response (counts the whole taxonomy). */
export interface ProductFacet {
  category_id: number;
  slug: string;
  label: string;
  emoji: string;
  sort_order: number;
  product_count: number;
}

/** Response from `GET /stores/{license_number}/products`. */
export interface StoreProducts {
  license_number: string;
  products: StoreProduct[];
  facets: ProductFacet[];
}

/** Fetch a store's product catalog by license number. */
export function getStoreProducts(
  licenseNumber: string,
  signal?: AbortSignal,
): Promise<StoreProducts> {
  return getJson<StoreProducts>(`/stores/${encodeURIComponent(licenseNumber)}/products`, signal);
}

/**
 * 'report' = update to an existing store; 'new' = a brand-new bodega;
 * 'delete' = flag an existing store as false/closed (not a real bodega).
 */
export type ReportMode = 'report' | 'new' | 'delete';

/** A crowd-sourced report posted to `POST /submissions` (multipart/form-data). */
export interface StoreReport {
  mode: ReportMode;
  /** Present when reporting on an existing store; omitted for a new bodega. */
  license_number?: string;
  name: string;
  /** Combined single-line address (kept for back-compat with the string field). */
  address: string;
  /** Structured address parts from the location picker's reverse geocode. */
  house?: string;
  street?: string;
  city?: string;
  zip?: string;
  /** Coordinates for the store, taken from the map location picker. */
  lat?: number;
  lon?: number;
  /** Feature answers keyed by submission field name (e.g. `lottery`) → 'yes' | 'no'. */
  answers: Record<string, 'yes' | 'no'>;
  hours?: string;
  receipt?: File | null;
  photos?: File[];
}

/** Submit a crowd-sourced report (or a new bodega) as multipart form data. */
export async function submitReport(report: StoreReport, signal?: AbortSignal): Promise<void> {
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

/** Structured address parts from a reverse geocode (any may be empty). */
export interface ReverseAddress {
  house: string;
  street: string;
  city: string;
  zip: string;
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
