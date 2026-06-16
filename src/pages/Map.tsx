import { useMemo, useState } from 'react';
import { IonContent, IonPage } from '@ionic/react';
import AppHeader from '../components/organisms/AppHeader';
import StoreMap from '../components/organisms/StoreMap';
import StoreDetailSheet from '../components/organisms/StoreDetailSheet';
import NewBodegaForm from '../components/organisms/NewBodegaForm';
import { useStores } from '../context/StoresContext';
import { FILTERS } from '../lib/filters';
import type { StoreFilters } from '../lib/api';

const Map: React.FC = () => {
  // Active filter keys -> getStores() query params (the FAB toggles them).
  const { activeFilters } = useStores();
  // The "add bodega" sheet, opened from the header "+" button.
  const [addOpen, setAddOpen] = useState(false);

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
      <AppHeader
        end={
          <button
            type="button"
            className="app-header__add-btn"
            aria-label="Add bodega"
            onClick={() => setAddOpen(true)}
          >
            + Bodega
          </button>
        }
      />

      <IonContent scrollY={false}>
        <StoreMap filters={filters} />
      </IonContent>

      <StoreDetailSheet />

      <NewBodegaForm isOpen={addOpen} onDidDismiss={() => setAddOpen(false)} />
    </IonPage>
  );
};

export default Map;
