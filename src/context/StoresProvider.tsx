import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getStore, getStoreProducts, getStores } from '../lib/api';
import type { Bbox, Product, Store, StoreFilters, StorePin } from '../lib/types';
import { track } from '../lib/analytics';
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

  // One in-flight request each — a newer call aborts the previous.
  const pinsCtrl = useRef<AbortController | null>(null);
  const detailCtrl = useRef<AbortController | null>(null);

  const loadStores = useCallback((bbox: Bbox, filters?: StoreFilters) => {
    pinsCtrl.current?.abort();
    const ctrl = new AbortController();
    pinsCtrl.current = ctrl;
    setPinsLoading(true);
    getStores(bbox, filters, ctrl.signal)
      .then((data) => {
        if (ctrl.signal.aborted) return;
        setPins(data);
        setPinsError(null);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setPinsError(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => {
        if (pinsCtrl.current === ctrl) setPinsLoading(false);
      });
  }, []);

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
    getStore(licenseNumber, ctrl.signal)
      .then((data) => {
        if (ctrl.signal.aborted) return;
        setSelected(data);
        setSelectedError(null);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setSelectedError(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => {
        if (detailCtrl.current === ctrl) setSelectedLoading(false);
      });

    // Products catalog — fetched on open into state (UI to come).
    getStoreProducts(licenseNumber, ctrl.signal)
      .then((data) => {
        if (ctrl.signal.aborted) return;
        console.log('store products', licenseNumber, data);
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

  // Abort any in-flight requests on unmount.
  useEffect(
    () => () => {
      pinsCtrl.current?.abort();
      detailCtrl.current?.abort();
    },
    [],
  );

  const value = useMemo<StoresContextValue>(
    () => ({
      pins,
      pinsLoading,
      pinsError,
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
