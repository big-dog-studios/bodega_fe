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
 * Master list of every feature filter, shown in the menu drawer. Order here is
 * the display order.
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
  { key: 'wic', label: 'WIC', icon: '🍼', param: 'has_wic' },
  { key: 'quickDraw', label: 'QUICK DRAW', icon: '🎰', param: 'has_quick_draw' },
  { key: 'products', label: 'HAS MENU', icon: '🛍️', param: 'has_products' },
];

/** Look up a filter definition by key. */
export const getFilter = (key: string): StoreFilter | undefined =>
  FILTERS.find((f) => f.key === key);
