import { useCallback, useEffect, useMemo, useState } from 'react';
import { Preferences } from '@capacitor/preferences';
import { track } from '../lib/analytics';
import { spotlightIndex } from '../lib/spotlight';
import { favoriteItem, SPOTLIGHT_DOMAIN } from '../lib/spotlightItems';
import {
  FavoritesContext,
  type FavoriteStore,
  type FavoritesContextValue,
} from './FavoritesContext';

/** Preferences key holding the JSON array of favorited stores. */
const FAVORITES_KEY = 'favorites';

/** Owns the user's favorites, persisted on-device via @capacitor/preferences. */
export const FavoritesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // null = still loading from storage; an array once loaded. The sentinel keeps
  // the save effect from writing (and clobbering storage) before the load runs.
  const [favorites, setFavorites] = useState<FavoriteStore[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    Preferences.get({ key: FAVORITES_KEY })
      .then(({ value }) => {
        if (cancelled) return;
        let clean: FavoriteStore[] = [];
        if (value) {
          try {
            const parsed: unknown = JSON.parse(value);
            // Keep only well-formed entries — drops legacy/partial data.
            if (Array.isArray(parsed)) {
              clean = parsed.filter(
                (f) =>
                  f &&
                  typeof f.license_number === 'string' &&
                  Number.isFinite(f.lat) &&
                  Number.isFinite(f.lon),
              ) as FavoriteStore[];
            }
          } catch {
            // corrupt value — start clean
          }
        }
        setFavorites(clean);
      })
      .catch(() => {
        if (!cancelled) setFavorites([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist on every change, once loaded.
  useEffect(() => {
    if (favorites === null) return;
    void Preferences.set({ key: FAVORITES_KEY, value: JSON.stringify(favorites) });
  }, [favorites]);

  const toggleFavorite = useCallback((store: FavoriteStore) => {
    let on = false;
    setFavorites((prev) => {
      const base = prev ?? [];
      const exists = base.some((f) => f.license_number === store.license_number);
      on = !exists;
      return exists
        ? base.filter((f) => f.license_number !== store.license_number)
        : [...base, store];
    });
    // Outside the updater so it fires once (StrictMode double-invokes updaters).
    track('Favorite Toggled', { license_number: store.license_number, on });
    // Mirror to Spotlight. On un-star, demote to the "viewed" domain rather than
    // deleting — a viewed + favorited store shares one id, so deleting would also
    // drop it from the viewed index (and favoriting always implies a view).
    void spotlightIndex([
      on ? favoriteItem(store) : { ...favoriteItem(store), domain: SPOTLIGHT_DOMAIN.viewed },
    ]);
  }, []);

  const list = favorites ?? [];

  const isFavorite = useCallback(
    (licenseNumber: string) => list.some((f) => f.license_number === licenseNumber),
    [list],
  );

  const value = useMemo<FavoritesContextValue>(
    () => ({ favorites: list, toggleFavorite, isFavorite }),
    [list, toggleFavorite, isFavorite],
  );

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
};
