import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  getStore,
  getStores,
  type Bbox,
  type StoreDetail,
  type StoreFilters,
  type StorePin,
} from '../lib/api';
import { StoresContext, type StoresContextValue } from './StoresContext';

/** Owns the shared stores state and the API calls that populate it. */
export const StoresProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [pins, setPins] = useState<StorePin[]>([]);
  const [pinsLoading, setPinsLoading] = useState(false);
  const [pinsError, setPinsError] = useState<Error | null>(null);

  const [selected, setSelected] = useState<StoreDetail | null>(null);
  const [selectedLoading, setSelectedLoading] = useState(false);
  const [selectedError, setSelectedError] = useState<Error | null>(null);

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
    detailCtrl.current?.abort();
    const ctrl = new AbortController();
    detailCtrl.current = ctrl;
    setSelectedLoading(true);
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
  }, []);

  const clearSelected = useCallback(() => setSelected(null), []);

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
      selected,
      selectedLoading,
      selectedError,
      selectStore,
      clearSelected,
    }),
    [
      pins,
      pinsLoading,
      pinsError,
      loadStores,
      selected,
      selectedLoading,
      selectedError,
      selectStore,
      clearSelected,
    ],
  );

  return <StoresContext.Provider value={value}>{children}</StoresContext.Provider>;
};
