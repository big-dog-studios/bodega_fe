import { useMemo } from 'react';
import { IonContent, IonFooter, IonMenuButton, IonPage } from '@ionic/react';
import AppHeader from '../components/organisms/AppHeader';
import StoreMap from '../components/organisms/StoreMap';
import StoreDetailSheet from '../components/organisms/StoreDetailSheet';
import { APP_MENU_ID, MENU_FILTERS } from '../components/organisms/AppMenu';
import FilterBar, { STORE_FILTERS } from '../components/molecules/FilterBar';
import { useStores } from '../context/StoresContext';
import type { StoreFilters } from '../lib/api';

const Map: React.FC = () => {
  // Filter state is shared (filter bar + menu drawer) via the stores context.
  const { activeFilters, toggleFilter } = useStores();

  // Active toggles -> getStores() query params, across both the bar and the menu.
  const filters = useMemo<StoreFilters>(() => {
    const f: StoreFilters = {};
    for (const def of [...STORE_FILTERS, ...MENU_FILTERS]) {
      if (activeFilters.has(def.key)) f[def.param] = true;
    }
    return f;
  }, [activeFilters]);

  return (
    <IonPage>
      <AppHeader
        end={<IonMenuButton menu={APP_MENU_ID} className="app-header__menu-btn" autoHide={false} />}
      />

      <IonContent scrollY={false}>
        <StoreMap filters={filters} />
      </IonContent>

      <IonFooter>
        <FilterBar active={activeFilters} onToggle={toggleFilter} />
      </IonFooter>

      <StoreDetailSheet />
    </IonPage>
  );
};

export default Map;
