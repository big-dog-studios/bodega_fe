import { useEffect } from 'react';
import { useStores } from '../context/StoresContext';
import { onAppOpenRoute } from '../lib/appRouter';

/**
 * Routes native deep-links — Spotlight results, App Intents / Siri, universal
 * links — into the app: `bodega:{license}` opens that store's sheet; `filter:{key}`
 * applies the feature filter on the map. Renders nothing.
 */
const DeepLinkRouter: React.FC = () => {
  const { selectStore, activeFilters, toggleFilter, clearSelected } = useStores();

  useEffect(
    () =>
      onAppOpenRoute((route) => {
        if (route.startsWith('bodega:')) {
          selectStore(route.slice('bodega:'.length));
        } else if (route.startsWith('filter:')) {
          const key = route.slice('filter:'.length);
          clearSelected();
          if (!activeFilters.has(key)) toggleFilter(key);
        }
      }),
    [selectStore, activeFilters, toggleFilter, clearSelected],
  );

  return null;
};

export default DeepLinkRouter;
