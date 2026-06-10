import { useState } from 'react';
import { IonContent, IonFooter, IonPage } from '@ionic/react';
import AppHeader from '../components/AppHeader';
import FilterBar from '../components/FilterBar';
import ResultsBadge from '../components/ResultsBadge';

const Map: React.FC = () => {
  // Multi-select: each filter key toggles independently.
  const [active, setActive] = useState<Set<string>>(new Set());

  // TODO: wire to the actual number of pins once the map/data loop lands.
  const resultCount = 0;

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
      <AppHeader end={<ResultsBadge count={resultCount} />} />

      <IonContent fullscreen />

      <IonFooter>
        <FilterBar active={active} onToggle={toggle} />
      </IonFooter>
    </IonPage>
  );
};

export default Map;
