import { useMemo } from 'react';
import { IonContent, IonFooter, IonMenuButton, IonPage } from '@ionic/react';
import { menuController } from '@ionic/core/components';
import AppHeader from '../components/organisms/AppHeader';
import StoreMap from '../components/organisms/StoreMap';
import StoreDetailSheet from '../components/organisms/StoreDetailSheet';
import { APP_MENU_ID } from '../components/organisms/AppMenu';
import FilterBar from '../components/molecules/FilterBar';
import { useStores } from '../context/StoresContext';
import { FILTERS } from '../lib/filters';
import type { StoreFilters } from '../lib/api';
import './Map.scss';

const Map: React.FC = () => {
  // Filter state is shared (filter bar + menu drawer) via the stores context.
  const { activeFilters, toggleFilter } = useStores();

  // Active toggles -> getStores() query params, across both the bar and the menu.
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
        end={<IonMenuButton menu={APP_MENU_ID} className="app-header__menu-btn" autoHide={false} />}
      />

      <IonContent scrollY={false}>
        <StoreMap filters={filters} />
      </IonContent>

      <IonFooter>
        <FilterBar active={activeFilters} onToggle={toggleFilter} />
      </IonFooter>

      <StoreDetailSheet />

      {/* Dims the content while the reveal menu is open (toggled via body class
          in AppMenu). Sits inside the page so it slides with the content. */}
      <button
        type="button"
        className="map-dim"
        aria-label="Close menu"
        onClick={() => menuController.close(APP_MENU_ID)}
      />
    </IonPage>
  );
};

export default Map;
