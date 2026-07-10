/**
 * Shared domain types. These describe the store entity itself — not how it's
 * fetched or stored — so both the API client (`api.ts`) and the local DB import
 * from here, and neither depends on the other.
 */

/** A geographic bbox in API order: west, south, east, north (lon/lat). */
export type Bbox = readonly [west: number, south: number, east: number, north: number];

/** One day's hours. `dow` 0=Mon … 6=Sun; minutes since midnight (null = unknown). */
export interface StoreHour {
  dow: number;
  open_min: number | null;
  close_min: number | null;
}

/**
 * The canonical store record — every field the app holds for a store, as
 * returned by `/sync/stores`. Detail UI, filtering, and the local DB all use this.
 */
export interface Store {
  license_number: string;
  dba: string;
  /** Identity / address. */
  entity: string;
  house: string;
  street: string;
  city: string;
  county: string;
  zip: string;
  estab_type: string;
  /** Feature flags. */
  has_snap: boolean;
  has_tobacco: boolean;
  has_lottery: boolean;
  has_quick_draw: boolean;
  has_prepared_food: boolean;
  has_wic: boolean;
  has_atm: boolean;
  has_cat: boolean;
  has_plant_based: boolean;
  /** Resident bodega cat's name, when known. */
  cat_name: string | null;
  /** Alcohol class code; null = no alcohol license. */
  alc_class: number | null;
  alc_description: string | null;
  alc_product: string | null;
  /** Google Places enrichment — null when not matched/enriched. */
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
  /** Human-readable hours line, e.g. "M-Th: 8AM - 11PM". */
  hours_summary: string | null;
  /**
   * Crowd-sourced storefront photos as storage object paths (e.g.
   * `submissions/<license>/photo/<uuid>.jpg`), NOT full URLs — the bucket is
   * private. Resolve to a fetchable URL with `storefrontPhotoUrl()` in `api.ts`.
   * Empty array when the store has no photos.
   */
  storefront_photos: string[];
  /** Structured weekly hours. */
  hours: StoreHour[];
  /** Soft-delete: hidden stores are dropped from the local DB on sync. */
  is_hidden: boolean;
  /** Last-modified marker; the sync cursor advances past this. */
  updated_at: string;
  lat: number;
  lon: number;
}

/** The slim projection the map's GeoJSON consumes — just the 4 pin fields. */
export type StorePin = Pick<Store, 'license_number' | 'dba' | 'lat' | 'lon'>;

/**
 * Feature filters. Each provided flag narrows the result; omitted flags don't.
 * `has_alcohol` maps to a non-null `alc_class`; `is_open` evaluates `hours`.
 */
export interface StoreFilters {
  has_snap?: boolean;
  has_tobacco?: boolean;
  has_lottery?: boolean;
  has_quick_draw?: boolean;
  has_prepared_food?: boolean;
  has_plant_based?: boolean;
  has_alcohol?: boolean;
  has_cat?: boolean;
  has_atm?: boolean;
  has_wic?: boolean;
  takeout?: boolean;
  delivery?: boolean;
  has_products?: boolean;
  is_open?: boolean;
}

/** Response envelope from `/sync/stores`. `server_time` becomes the next cursor. */
export interface SyncResponse {
  stores: Store[];
  server_time: string;
}

/** A single catalog item from `GET /stores/{license_number}/products`. */
export interface Product {
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
  products: Product[];
  facets: ProductFacet[];
}

/**
 * 'report' = update to an existing store; 'new' = a brand-new bodega;
 * 'delete' = flag an existing store as false/closed (not a real bodega).
 */
export type ReportMode = 'report' | 'new' | 'delete';

/** A crowd-sourced report posted to `POST /submissions` (multipart/form-data). */
export interface Report {
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
  county?: string;
  zip?: string;
  /** Coordinates for the store, taken from the map location picker. */
  lat?: number;
  lon?: number;
  /** Feature answers keyed by submission field name (e.g. `lottery`) → 'yes' | 'no'. */
  answers: Record<string, 'yes' | 'no'>;
  hours?: string;
  receipt?: File | null;
  photos?: File[];
  /** Anonymous user id (device-derived) to attribute the submission. */
  user_id?: string;
}

/** Structured address parts from a reverse geocode (any may be empty). */
export interface ReverseAddress {
  house: string;
  street: string;
  /** Neighborhood (Nominatim `neighbourhood`), e.g. "Ridgewood". */
  city: string;
  /** Borough (Nominatim `suburb`), e.g. "Queens". */
  county: string;
  zip: string;
}
