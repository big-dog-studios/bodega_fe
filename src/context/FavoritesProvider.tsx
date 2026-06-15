import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Preferences } from '@capacitor/preferences';
import {
  FavoritesContext,
  type FavoriteStore,
  type FavoritesContextValue,
} from './FavoritesContext';

/** Preferences key holding the JSON array of favorited stores. */
const FAVORITES_KEY = 'favorites';

/** Owns the user's favorites, persisted on-device via @capacitor/preferences. */
export const FavoritesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [favorites, setFavorites] = useState<FavoriteStore[]>([]);
  // Don't write back until the initial load finishes (else we clobber storage).
  const loaded = useRef(false);

  useEffect(() => {
    let cancelled = false;
    Preferences.get({ key: FAVORITES_KEY }).then(({ value }) => {
      if (cancelled) return;
      if (value) {
        try {
          const parsed: unknown = JSON.parse(value);
          // Keep only well-formed entries — drops legacy/partial data (e.g. the
          // old string-only format that has no coords).
          const clean = Array.isArray(parsed)
            ? (parsed.filter(
                (f) =>
                  f &&
                  typeof f.license_number === 'string' &&
                  Number.isFinite(f.lat) &&
                  Number.isFinite(f.lon),
              ) as FavoriteStore[])
            : [];
          setFavorites(clean);
        } catch {
          // corrupt value — start clean
        }
      }
      loaded.current = true;
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    void Preferences.set({ key: FAVORITES_KEY, value: JSON.stringify(favorites) });
  }, [favorites]);

  const toggleFavorite = useCallback((store: FavoriteStore) => {
    setFavorites((prev) =>
      prev.some((f) => f.license_number === store.license_number)
        ? prev.filter((f) => f.license_number !== store.license_number)
        : [...prev, store],
    );
  }, []);

  const isFavorite = useCallback(
    (licenseNumber: string) => favorites.some((f) => f.license_number === licenseNumber),
    [favorites],
  );

  const value = useMemo<FavoritesContextValue>(
    () => ({ favorites, toggleFavorite, isFavorite }),
    [favorites, toggleFavorite, isFavorite],
  );

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
};
