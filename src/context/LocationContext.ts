import { createContext, useContext } from 'react';

/** The user's last known in-NYC location, or null before it's acquired. */
export type UserLocation = { lat: number; lon: number } | null;

/**
 * Live location is split into two contexts on purpose:
 *
 * - The *state* changes on every GPS tick (a few times a second while walking),
 *   so anything subscribed to it re-renders that often. Only components that
 *   actually need the coordinates should read it.
 * - The *setter* is identity-stable, so the writer (the map) can update location
 *   without ever re-rendering itself or any other setter consumer.
 *
 * Keeping them separate means a high-frequency stream doesn't drag unrelated
 * consumers (the detail sheet, the map page) into a re-render on every tick.
 */
export const LocationStateContext = createContext<UserLocation>(null);
export const LocationSetterContext = createContext<(loc: UserLocation) => void>(() => {});

/** Read the user's live location. Re-renders on every GPS update — use sparingly. */
export function useUserLocation(): UserLocation {
  return useContext(LocationStateContext);
}

/** The stable setter for the user's location. Reading it never causes a re-render. */
export function useSetUserLocation(): (loc: UserLocation) => void {
  return useContext(LocationSetterContext);
}
