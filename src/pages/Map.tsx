import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IonContent, IonPage } from '@ionic/react';
import AppHeader from '../components/organisms/AppHeader';
import StoreMap from '../components/organisms/StoreMap';
import StoreDetailSheet from '../components/organisms/StoreDetailSheet';
import NewBodegaForm from '../components/organisms/NewBodegaForm';
import { useStores } from '../context/StoresContext';
import { track } from '../lib/analytics';
import { FILTERS } from '../lib/filters';
import type { StoreFilters } from '../lib/types';

const Map: React.FC = () => {
  const { t } = useTranslation();
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
            aria-label={t('map.addBodegaAria')}
            onClick={() => {
              track('Add Bodega Opened');
              setAddOpen(true);
            }}
          >
            {t('map.addBodega')}
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
