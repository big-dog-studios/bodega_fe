import { createContext, useContext } from 'react';
import type { Bbox, Product, Store, StoreFilters, StorePin } from '../lib/types';

export interface StoresContextValue {
  /** Pins from the last getStores() call. */
  pins: StorePin[];
  pinsLoading: boolean;
  pinsError: Error | null;
  /** True until the local DB has stores — drives the cold-start sync loader. */
  hydrating: boolean;
  /** Fetch pins for a viewport (optionally filtered) and save them to context. */
  loadStores: (bbox: Bbox, filters?: StoreFilters) => void;

  /** Active feature-filter keys, shared by the filter bar and the menu drawer. */
  activeFilters: Set<string>;
  /** Toggle one filter key on/off. */
  toggleFilter: (key: string) => void;

  /** License number of the selected pin — set immediately on selectStore() for instant UI. */
  selectedId: string | null;
  /** The store whose detail was last fetched via selectStore(). */
  selected: Store | null;
  selectedLoading: boolean;
  selectedError: Error | null;
  /** Fetch one store's full record and save it to context. */
  selectStore: (licenseNumber: string) => void;
  clearSelected: () => void;

  /** Catalog for the selected store; reset to [] on every selectStore(). */
  products: Product[];
  productsLoading: boolean;
  productsError: Error | null;
}

export const StoresContext = createContext<StoresContextValue | null>(null);

/** Access the shared stores state. Must be used within <StoresProvider>. */
export function useStores(): StoresContextValue {
  const ctx = useContext(StoresContext);
  if (!ctx) {
    throw new Error('useStores must be used within a StoresProvider');
  }
  return ctx;
}
