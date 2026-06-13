/**
 * Thin client over the Map API. See CLAUDE.md "API contract".
 * IMPORTANT axis order: the API bbox is lon-first — [west, south, east, north].
 */

/** Base URL of the Map API — one config value (CLAUDE.md), never inline at the call. */
const API_BASE_URL: string = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080').replace(
  /\/+$/,
  '',
);

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
}

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, { signal });
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
  category_id: number;
  category: string;
  category_slug: string;
  emoji: string;
  is_packaged: boolean;
}

/** Response from `GET /stores/{license_number}/products`. */
export interface StoreProducts {
  license_number: string;
  products: StoreProduct[];
}

/** Fetch a store's product catalog by license number. */
export function getStoreProducts(
  licenseNumber: string,
  signal?: AbortSignal,
): Promise<StoreProducts> {
  return getJson<StoreProducts>(`/stores/${encodeURIComponent(licenseNumber)}/products`, signal);
}

/** A crowd-sourced report posted to `POST /submissions` (multipart/form-data). */
export interface StoreReport {
  license_number: string;
  /** Feature answers keyed by submission field name (e.g. `lottery`) → 'yes' | 'no'. */
  answers: Record<string, 'yes' | 'no'>;
  hours?: string;
  receipt?: File | null;
  photos?: File[];
}

/** Submit a crowd-sourced report for a store as multipart form data. */
export async function submitReport(report: StoreReport, signal?: AbortSignal): Promise<void> {
  const form = new FormData();
  form.set('license_number', report.license_number);
  for (const [field, value] of Object.entries(report.answers)) {
    form.set(field, value);
  }
  if (report.hours?.trim()) form.set('hours', report.hours.trim());
  if (report.receipt) form.set('receipt', report.receipt);
  for (const photo of report.photos ?? []) form.append('photos', photo);

  const res = await fetch(`${API_BASE_URL}/submissions`, { method: 'POST', body: form, signal });
  if (!res.ok) {
    throw new Error(`API ${res.status} for /submissions`);
  }
}
