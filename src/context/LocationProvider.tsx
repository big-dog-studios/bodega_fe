import { useState } from 'react';
import { LocationSetterContext, LocationStateContext, type UserLocation } from './LocationContext';

/**
 * Owns the user's live location, isolated from the rest of the app state so its
 * frequent updates only re-render the components that actually read coordinates.
 *
 * The setter comes straight from useState, so its identity is stable for the
 * provider's lifetime — no need to memoize it. The state value is passed through
 * as-is; consumers of LocationStateContext re-render when it changes, which is
 * exactly who should.
 */
export const LocationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [userLocation, setUserLocation] = useState<UserLocation>(null);

  return (
    <LocationSetterContext.Provider value={setUserLocation}>
      <LocationStateContext.Provider value={userLocation}>{children}</LocationStateContext.Provider>
    </LocationSetterContext.Provider>
  );
};
