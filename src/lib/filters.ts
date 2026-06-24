import type { StoreFilters } from './types';

/** One feature filter: a UI chip mapped to a `GET /stores` query param. */
export interface StoreFilter {
  key: string;
  /** i18n key for the chip label (resolved with t() at render). */
  labelKey: string;
  icon: string;
  /** The getStores() query param this filter sets. */
  param: keyof StoreFilters;
}

/**
 * Master list of every feature filter, shown in the menu drawer. Order here is
 * the display order.
 */
export const FILTERS: StoreFilter[] = [
  { key: 'openNow', labelKey: 'features.openNow', icon: '🕑', param: 'is_open' },
  { key: 'preparedFood', labelKey: 'features.preparedFood', icon: '🥪', param: 'has_prepared_food' },
  { key: 'plantBased', labelKey: 'features.plantBased', icon: '🌱', param: 'has_plant_based' },
  { key: 'lottery', labelKey: 'features.lottery', icon: '🎟', param: 'has_lottery' },
  { key: 'alcohol', labelKey: 'features.alcohol', icon: '🍺', param: 'has_alcohol' },
  { key: 'tobacco', labelKey: 'features.tobacco', icon: '🚬', param: 'has_tobacco' },
  { key: 'cat', labelKey: 'features.cat', icon: '🐈', param: 'has_cat' },
  { key: 'atm', labelKey: 'features.atm', icon: '🏧', param: 'has_atm' },
  { key: 'delivery', labelKey: 'features.delivery', icon: '🛵', param: 'delivery' },
  { key: 'takeout', labelKey: 'features.takeout', icon: '🥡', param: 'takeout' },
  { key: 'snap', labelKey: 'features.snap', icon: '🛒', param: 'has_snap' },
  { key: 'wic', labelKey: 'features.wic', icon: '🍼', param: 'has_wic' },
  { key: 'quickDraw', labelKey: 'features.quickDraw', icon: '🎰', param: 'has_quick_draw' },
  { key: 'products', labelKey: 'features.products', icon: '🛍️', param: 'has_products' },
];

/** Look up a filter definition by key. */
export const getFilter = (key: string): StoreFilter | undefined =>
  FILTERS.find((f) => f.key === key);
