import { useEffect, useState } from 'react';
import { getDeviceId } from '../lib/device';
import { UserContext } from './UserContext';

/**
 * Resolves the user id once on mount and holds it in global state. The id is
 * derived from the device and never changes within an install, so this fetches a
 * single time. getDeviceId() is cached, so this shares the exact value analytics
 * init reads — no divergence.
 */
export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getDeviceId().then((id) => {
      if (!cancelled) setUserId(id);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return <UserContext.Provider value={userId}>{children}</UserContext.Provider>;
};
