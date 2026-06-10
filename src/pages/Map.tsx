import { useMemo, useState } from 'react';
import { IonContent, IonFooter, IonPage } from '@ionic/react';
import AppHeader from '../components/organisms/AppHeader';
import StoreMap from '../components/organisms/StoreMap';
import StoreDetailSheet from '../components/organisms/StoreDetailSheet';
import FilterBar, { STORE_FILTERS } from '../components/molecules/FilterBar';
import ResultsBadge from '../components/atoms/ResultsBadge';
import type { StoreFilters } from '../lib/api';

const Map: React.FC = () => {
  // Multi-select: each filter key toggles independently.
  const [active, setActive] = useState<Set<string>>(new Set());

  const toggle = (key: string) => {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Active toggles -> getStores() query params (each active filter requires has_X=true).
  const filters = useMemo<StoreFilters>(() => {
    const f: StoreFilters = {};
    for (const def of STORE_FILTERS) {
      if (active.has(def.key)) f[def.param] = true;
    }
    return f;
  }, [active]);

  return (
    <IonPage>
      <AppHeader end={<ResultsBadge count={0} />} />

      <IonContent scrollY={false}>
        <StoreMap filters={filters} />
      </IonContent>

      <IonFooter>
        <FilterBar active={active} onToggle={toggle} />
      </IonFooter>

      <StoreDetailSheet />
    </IonPage>
  );
};

export default Map;
