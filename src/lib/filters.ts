import type { StoreFilters } from './api';

/** One feature filter: a UI chip mapped to a `GET /stores` query param. */
export interface StoreFilter {
  key: string;
  label: string;
  icon: string;
  /** The getStores() query param this filter sets. */
  param: keyof StoreFilters;
}

/**
 * Master list of every feature filter. The bottom bar shows a user-chosen
 * subset (the "hotbar"); the menu drawer shows the rest. Order here is the
 * default order.
 */
export const FILTERS: StoreFilter[] = [
  { key: 'preparedFood', label: 'HOT FOOD', icon: '🥪', param: 'has_prepared_food' },
  { key: 'lottery', label: 'LOTTERY', icon: '🎟', param: 'has_lottery' },
  { key: 'alcohol', label: 'BEER & WINE', icon: '🍺', param: 'has_alcohol' },
  { key: 'tobacco', label: 'TOBACCO', icon: '🚬', param: 'has_tobacco' },
  { key: 'cat', label: 'CAT', icon: '🐈', param: 'has_cat' },
  { key: 'atm', label: 'ATM', icon: '🏧', param: 'has_atm' },
  { key: 'delivery', label: 'DELIVERY', icon: '🛵', param: 'delivery' },
  { key: 'takeout', label: 'TAKEOUT', icon: '🥡', param: 'takeout' },
  { key: 'snap', label: 'SNAP/EBT', icon: '🛒', param: 'has_snap' },
  { key: 'quickDraw', label: 'QUICK DRAW', icon: '🎰', param: 'has_quick_draw' },
  { key: 'products', label: 'HAS MENU', icon: '🛍️', param: 'has_products' },
];

/** Default bottom-bar contents: the top four filters. */
export const DEFAULT_HOTBAR_KEYS: string[] = FILTERS.slice(0, 4).map((f) => f.key);

/** Look up a filter definition by key. */
export const getFilter = (key: string): StoreFilter | undefined =>
  FILTERS.find((f) => f.key === key);
