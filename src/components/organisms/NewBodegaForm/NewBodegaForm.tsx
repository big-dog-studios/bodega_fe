import { IonContent, IonModal } from '@ionic/react';
import './NewBodegaForm.scss';

/** id of the trigger element (the "+ Add bodega" button) that opens this sheet. */
export const NEW_BODEGA_TRIGGER_ID = 'add-bodega-trigger';

/**
 * Bottom-sheet modal with the form for submitting a new bodega — same style as
 * the store detail sheet. Opened by the "+ Add bodega" pill in AppMenu via the
 * IonModal `trigger`. Form fields are a scaffold for now.
 */
const NewBodegaForm: React.FC = () => (
  <IonModal
    className="new-bodega"
    trigger={NEW_BODEGA_TRIGGER_ID}
    breakpoints={[0, 0.9]}
    initialBreakpoint={0.9}
    expandToScroll={false}
  >
    <IonContent className="new-bodega__content">
      <div className="new-bodega__tag">NEW BODEGA</div>
      <p className="new-bodega__label">ADD A BODEGA</p>
      <p className="new-bodega__hint">Know a spot we&apos;re missing? Tell us about it.</p>
    </IonContent>
  </IonModal>
);

export default NewBodegaForm;
