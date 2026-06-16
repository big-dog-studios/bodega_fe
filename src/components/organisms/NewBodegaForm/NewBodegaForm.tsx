import { useRef, useState } from 'react';
import { IonContent, IonFooter, IonModal, IonSpinner, useIonToast } from '@ionic/react';
import ReportForm from '../ReportForm';
import './NewBodegaForm.scss';

/**
 * id of the trigger element that opens this sheet. The sidebar that held the
 * "+ Add bodega" button was removed, so nothing currently renders this id — the
 * form stays wired up and reachable again as soon as a new trigger is added.
 */
export const NEW_BODEGA_TRIGGER_ID = 'add-bodega-trigger';

/** Form id linking the footer submit button to the shared ReportForm. */
const NEW_BODEGA_FORM_ID = 'new-bodega-form';

/**
 * Bottom-sheet modal for adding a new bodega — same style as the detail sheet.
 * Reuses ReportForm with no `store`, so its name/address start blank and it
 * submits in "new" mode. Opened via the IonModal `trigger` (see the id above).
 */
const NewBodegaForm: React.FC = () => {
  const modal = useRef<HTMLIonModalElement>(null);
  const [valid, setValid] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [presentToast] = useIonToast();

  return (
    <IonModal
      ref={modal}
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

        <ReportForm
          formId={NEW_BODEGA_FORM_ID}
          onValidityChange={setValid}
          onSubmittingChange={setSubmitting}
          onSubmitted={() => {
            presentToast({
              message: 'Thanks! Your bodega was submitted.',
              duration: 2500,
              position: 'top',
              color: 'success',
            });
            modal.current?.dismiss();
          }}
        />
      </IonContent>

      <IonFooter className="new-bodega__footer">
        <button
          type="submit"
          form={NEW_BODEGA_FORM_ID}
          className="new-bodega__submit"
          disabled={!valid || submitting}
        >
          {submitting ? <IonSpinner name="dots" /> : 'SUBMIT BODEGA'}
        </button>
      </IonFooter>
    </IonModal>
  );
};

export default NewBodegaForm;
