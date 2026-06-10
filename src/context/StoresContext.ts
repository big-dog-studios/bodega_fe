import { createContext, useContext } from 'react';
import type { Bbox, StoreDetail, StoreFilters, StorePin } from '../lib/api';

export interface StoresContextValue {
  /** Pins from the last getStores() call. */
  pins: StorePin[];
  pinsLoading: boolean;
  pinsError: Error | null;
  /** Fetch pins for a viewport (optionally filtered) and save them to context. */
  loadStores: (bbox: Bbox, filters?: StoreFilters) => void;

  /** License number of the selected pin — set immediately on selectStore() for instant UI. */
  selectedId: string | null;
  /** The store whose detail was last fetched via selectStore(). */
  selected: StoreDetail | null;
  selectedLoading: boolean;
  selectedError: Error | null;
  /** Fetch one store's full record and save it to context. */
  selectStore: (licenseNumber: string) => void;
  clearSelected: () => void;
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
