import { IonContent, IonModal } from '@ionic/react';
import { useStores } from '../../../context/StoresContext';

/** Bottom-sheet drawer for the selected store. Opens on pin select. (Unstyled for now.) */
const StoreDetailSheet: React.FC = () => {
  const { selectedId, selected, selectedLoading, clearSelected } = useStores();

  return (
    <IonModal
      isOpen={selectedId !== null}
      onDidDismiss={clearSelected}
      breakpoints={[0, 0.5, 0.9]}
      initialBreakpoint={0.5}
    >
      <IonContent className="ion-padding">
        {selectedLoading && !selected && <p>Loading…</p>}
        {selected && (
          <>
            <h2>{selected.dba}</h2>
            <p>License #{selected.license_number}</p>
          </>
        )}
      </IonContent>
    </IonModal>
  );
};

export default StoreDetailSheet;
