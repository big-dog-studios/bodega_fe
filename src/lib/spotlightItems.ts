/**
 * Builds Spotlight items from store/favorite/category data. Strings are localized
 * (so search matches the user's language) via the default i18n instance.
 */
import i18n from '../i18n';
import { FILTERS } from './filters';
import type { SpotlightItem } from './spotlight';
import type { Store } from './types';
import type { FavoriteStore } from '../context/FavoritesContext';

/** Spotlight grouping domains (clearable as a set). */
export const SPOTLIGHT_DOMAIN = {
  viewed: 'viewed',
  favorites: 'favorites',
  categories: 'categories',
} as const;

/** A store's deep-link / Spotlight id. One per store, shared across domains. */
export const bodegaItemId = (license: string): string => `bodega:${license}`;

/** Flag → feature label key, in display priority order. */
const FEATURE_FLAGS: ReadonlyArray<readonly [(s: Store) => boolean | null, string]> = [
  [(s) => s.alc_class != null, 'features.alcohol'],
  [(s) => s.has_prepared_food, 'features.preparedFood'],
  [(s) => s.has_snap, 'features.snap'],
  [(s) => s.has_lottery, 'features.lottery'],
  [(s) => s.has_tobacco, 'features.tobacco'],
  [(s) => s.has_atm, 'features.atm'],
  [(s) => s.has_cat, 'features.cat'],
  [(s) => s.has_wic, 'features.wic'],
  [(s) => s.has_quick_draw, 'features.quickDraw'],
  [(s) => s.takeout, 'features.takeout'],
  [(s) => s.delivery, 'features.delivery'],
];

const featureLabels = (s: Store): string[] =>
  FEATURE_FLAGS.filter(([test]) => test(s)).map(([, key]) => i18n.t(key));

const addressLine = (s: Store): string =>
  [[s.house, s.street].filter(Boolean).join(' '), s.county].filter(Boolean).join(', ');

/** A viewed store → rich searchable item (name, address, features). */
export function viewedItem(s: Store): SpotlightItem {
  const features = featureLabels(s);
  return {
    id: bodegaItemId(s.license_number),
    title: s.dba,
    subtitle: [addressLine(s), features.slice(0, 3).join(' · ')].filter(Boolean).join(' · '),
    keywords: [s.city, s.county, 'bodega', ...features].filter(Boolean) as string[],
    domain: SPOTLIGHT_DOMAIN.viewed,
  };
}

/** A favorited store (only name + coords are known at favorite time). */
export function favoriteItem(f: FavoriteStore): SpotlightItem {
  return {
    id: bodegaItemId(f.license_number),
    title: f.name,
    subtitle: i18n.t('spotlight.saved'),
    keywords: [f.name, 'bodega', i18n.t('spotlight.saved')],
    domain: SPOTLIGHT_DOMAIN.favorites,
  };
}

/** Feature collections (e.g. "SNAP/EBT") → open the map filtered to that feature. */
export function categoryItems(): SpotlightItem[] {
  return FILTERS.map((f) => {
    const label = i18n.t(f.labelKey);
    return {
      id: `filter:${f.key}`,
      title: label,
      subtitle: i18n.t('spotlight.findNearby', { feature: label }),
      keywords: [label, 'bodega', f.key],
      domain: SPOTLIGHT_DOMAIN.categories,
    };
  });
}
