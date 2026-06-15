import { useCallback, useEffect, useMemo, useState } from 'react';
import { Preferences } from '@capacitor/preferences';
import { DEFAULT_HOTBAR_KEYS, getFilter } from '../lib/filters';
import { HotbarContext, type HotbarContextValue } from './HotbarContext';

/** Preferences key holding the JSON array of bottom-bar filter keys. */
const HOTBAR_KEY = 'hotbar';

/** Owns the user's bottom-bar config, persisted on-device via @capacitor/preferences. */
export const HotbarProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // null = still loading; an array once loaded (keeps saves from clobbering).
  const [hotbar, setHotbarState] = useState<string[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    Preferences.get({ key: HOTBAR_KEY })
      .then(({ value }) => {
        if (cancelled) return;
        let keys = DEFAULT_HOTBAR_KEYS;
        if (value) {
          try {
            const parsed: unknown = JSON.parse(value);
            // Keep only keys that still exist in the master list.
            if (Array.isArray(parsed)) {
              const valid = parsed.filter(
                (k): k is string => typeof k === 'string' && !!getFilter(k),
              );
              if (valid.length > 0) keys = valid;
            }
          } catch {
            // corrupt value — fall back to defaults
          }
        }
        setHotbarState(keys);
      })
      .catch(() => {
        if (!cancelled) setHotbarState(DEFAULT_HOTBAR_KEYS);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (hotbar === null) return;
    void Preferences.set({ key: HOTBAR_KEY, value: JSON.stringify(hotbar) });
  }, [hotbar]);

  const setHotbar = useCallback((keys: string[]) => setHotbarState(keys), []);

  const hotbarKeys = hotbar ?? DEFAULT_HOTBAR_KEYS;

  const value = useMemo<HotbarContextValue>(
    () => ({ hotbarKeys, setHotbar }),
    [hotbarKeys, setHotbar],
  );

  return <HotbarContext.Provider value={value}>{children}</HotbarContext.Provider>;
};
