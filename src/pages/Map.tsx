import { useState } from 'react';
import { IonContent, IonFooter, IonPage } from '@ionic/react';
import AppHeader from '../components/organisms/AppHeader';
import StoreMap from '../components/organisms/StoreMap';
import FilterBar from '../components/molecules/FilterBar';
import ResultsBadge from '../components/atoms/ResultsBadge';

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

  return (
    <IonPage>
      <AppHeader end={<ResultsBadge count={0} />} />

      <IonContent scrollY={false}>
        <StoreMap />
      </IonContent>

      <IonFooter>
        <FilterBar active={active} onToggle={toggle} />
      </IonFooter>
    </IonPage>
  );
};

export default Map;
