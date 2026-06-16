import { useMemo } from 'react';
import { IonContent, IonPage } from '@ionic/react';
import AppHeader from '../components/organisms/AppHeader';
import StoreMap from '../components/organisms/StoreMap';
import StoreDetailSheet from '../components/organisms/StoreDetailSheet';
import { useStores } from '../context/StoresContext';
import { FILTERS } from '../lib/filters';
import type { StoreFilters } from '../lib/api';

const Map: React.FC = () => {
  // Active filter keys -> getStores() query params (the FAB + menu toggle them).
  const { activeFilters } = useStores();

  // Active toggles -> getStores() query params.
  const filters = useMemo<StoreFilters>(() => {
    const f: StoreFilters = {};
    for (const def of FILTERS) {
      if (activeFilters.has(def.key)) f[def.param] = true;
    }
    return f;
  }, [activeFilters]);

  return (
    <IonPage>
      <AppHeader />

      <IonContent scrollY={false}>
        <StoreMap filters={filters} />
      </IonContent>

      <StoreDetailSheet />
    </IonPage>
  );
};

export default Map;
