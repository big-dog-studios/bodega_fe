import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getStoreProducts } from '../lib/api';
import { getPins, getStore, storeCount } from '../lib/db';
import { onSynced } from '../lib/sync';
import type { Bbox, Product, Store, StoreFilters, StorePin } from '../lib/types';
import { track } from '../lib/analytics';
import { spotlightIndex } from '../lib/spotlight';
import { viewedItem } from '../lib/spotlightItems';
import { StoresContext, type StoresContextValue } from './StoresContext';

/** Owns the shared stores state and the API calls that populate it. */
export const StoresProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [pins, setPins] = useState<StorePin[]>([]);
  const [pinsLoading, setPinsLoading] = useState(false);
  const [pinsError, setPinsError] = useState<Error | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Store | null>(null);
  const [selectedLoading, setSelectedLoading] = useState(false);
  const [selectedError, setSelectedError] = useState<Error | null>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState<Error | null>(null);

  // Active feature filters — multi-select, each key toggles independently.
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());

  const toggleFilter = useCallback((key: string) => {
    let on = false;
    setActiveFilters((prev) => {
      on = !prev.has(key);
      const next = new Set(prev);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });
    // Outside the updater so it fires once (StrictMode double-invokes updaters).
    track('Filter Toggled', { filter: key, on });
  }, []);

  // True until the local DB has stores — drives the cold-start loader while the
  // first sync populates it. (Empty DB ≠ "no bodegas here"; it means not-yet-synced.)
  const [hydrating, setHydrating] = useState(true);

  // Pins come from the local DB now; a monotonic id discards stale async results.
  // The last viewport is remembered so a finished sync can re-query it in place.
  const pinsReq = useRef(0);
  const lastBbox = useRef<Bbox | null>(null);
  const lastFilters = useRef<StoreFilters | undefined>(undefined);
  // One in-flight detail request — products are still network, so keep aborting.
  const detailCtrl = useRef<AbortController | null>(null);

  const loadStores = useCallback((bbox: Bbox, filters?: StoreFilters): Promise<void> => {
    lastBbox.current = bbox;
    lastFilters.current = filters;
    const id = ++pinsReq.current;
    setPinsLoading(true);
    return getPins(bbox, filters)
      .then((data) => {
        if (pinsReq.current !== id) return; // a newer query superseded this one
        setPins(data);
        setPinsError(null);
      })
      .catch((err: unknown) => {
        if (pinsReq.current !== id) return;
        setPinsError(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => {
        if (pinsReq.current === id) setPinsLoading(false);
      });
  }, []);

  // Empty on a fresh install; show the loader until the first sync lands. After
  // any sync, drop the loader and re-query the current viewport so new pins
  // appear without the user having to nudge the map.
  useEffect(() => {
    let active = true;
    void storeCount().then((c) => {
      if (active && c > 0) setHydrating(false);
    });
    const off = onSynced(() => {
      if (!active) return;
      // Re-query the current viewport, and only drop the loader once the pins are
      // actually in — otherwise the loader vanishes a beat before the first pin.
      if (lastBbox.current) {
        void loadStores(lastBbox.current, lastFilters.current).then(() => {
          if (active) setHydrating(false);
        });
      } else {
        setHydrating(false);
      }
    });
    return () => {
      active = false;
      off();
    };
  }, [loadStores]);

  const selectStore = useCallback((licenseNumber: string) => {
    track('Store Selected', { license_number: licenseNumber });
    // Mark selected immediately so the pin updates without waiting on the fetch.
    setSelectedId(licenseNumber);
    // Reset the previous store's catalog so it can't flash while the new one loads.
    setProducts([]);
    setProductsError(null);
    detailCtrl.current?.abort();
    const ctrl = new AbortController();
    detailCtrl.current = ctrl;
    setSelectedLoading(true);
    setProductsLoading(true);
    getStore(licenseNumber)
      .then((data) => {
        if (detailCtrl.current !== ctrl) return; // a newer selection superseded this
        if (data) {
          setSelected(data);
          void spotlightIndex([viewedItem(data)]); // make viewed stores searchable
        } else {
          setSelectedError(new Error(`Store ${licenseNumber} not in local cache`));
        }
      })
      .catch((err: unknown) => {
        if (detailCtrl.current !== ctrl) return;
        setSelectedError(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => {
        if (detailCtrl.current === ctrl) setSelectedLoading(false);
      });

    // Products catalog — fetched on open into state (UI to come).
    getStoreProducts(licenseNumber, ctrl.signal)
      .then((data) => {
        if (ctrl.signal.aborted) return;
        console.log('[products]', licenseNumber, data);
        setProducts(data.products);
        setProductsError(null);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setProductsError(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => {
        if (detailCtrl.current === ctrl) setProductsLoading(false);
      });
  }, []);

  const clearSelected = useCallback(() => {
    setSelectedId(null);
    setSelected(null);
    setProducts([]);
    setProductsError(null);
  }, []);

  // Abort any in-flight detail request on unmount.
  useEffect(() => () => detailCtrl.current?.abort(), []);

  const value = useMemo<StoresContextValue>(
    () => ({
      pins,
      pinsLoading,
      pinsError,
      hydrating,
      loadStores,
      activeFilters,
      toggleFilter,
      selectedId,
      selected,
      selectedLoading,
      selectedError,
      selectStore,
      clearSelected,
      products,
      productsLoading,
      productsError,
    }),
    [
      pins,
      pinsLoading,
      pinsError,
      hydrating,
      loadStores,
      activeFilters,
      toggleFilter,
      selectedId,
      selected,
      selectedLoading,
      selectedError,
      selectStore,
      clearSelected,
      products,
      productsLoading,
      productsError,
    ],
  );

  return <StoresContext.Provider value={value}>{children}</StoresContext.Provider>;
};
