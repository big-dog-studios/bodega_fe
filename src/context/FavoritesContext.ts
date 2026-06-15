import { createContext, useContext } from 'react';

/** Minimal store info kept per favorite so the list/map don't need a refetch. */
export interface FavoriteStore {
  license_number: string;
  name: string;
  lat: number;
  lon: number;
}

export interface FavoritesContextValue {
  /** Favorited stores (persisted on-device). */
  favorites: FavoriteStore[];
  /** Toggle a store's favorite state. */
  toggleFavorite: (store: FavoriteStore) => void;
  /** Whether a store is currently favorited. */
  isFavorite: (licenseNumber: string) => boolean;
}

export const FavoritesContext = createContext<FavoritesContextValue | null>(null);

/** Access the on-device favorites. Must be used within <FavoritesProvider>. */
export function useFavorites(): FavoritesContextValue {
  const ctx = useContext(FavoritesContext);
  if (!ctx) {
    throw new Error('useFavorites must be used within a FavoritesProvider');
  }
  return ctx;
}
