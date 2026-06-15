import { createContext, useContext } from 'react';

export interface HotbarContextValue {
  /** Ordered filter keys shown in the bottom bar (persisted on-device). */
  hotbarKeys: string[];
  /** Replace the bottom-bar contents (for the customize UI, later). */
  setHotbar: (keys: string[]) => void;
}

export const HotbarContext = createContext<HotbarContextValue | null>(null);

/** Access the user's bottom-bar config. Must be used within <HotbarProvider>. */
export function useHotbar(): HotbarContextValue {
  const ctx = useContext(HotbarContext);
  if (!ctx) {
    throw new Error('useHotbar must be used within a HotbarProvider');
  }
  return ctx;
}
