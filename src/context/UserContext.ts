import { createContext, useContext } from 'react';

/**
 * The user's id — an anonymous identifier derived from the device (see
 * lib/device.ts). Null until it resolves. Held globally so analytics, the submit
 * call, and future user-data POSTs all read the same value.
 */
export const UserContext = createContext<string | null>(null);

/** Read the user id. Null on first render, then the resolved id. */
export function useUserId(): string | null {
  return useContext(UserContext);
}
