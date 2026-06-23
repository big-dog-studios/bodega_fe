import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IonContent, IonFooter, IonModal, IonSpinner, useIonToast } from '@ionic/react';
import ReportForm from '../ReportForm';
import './NewBodegaForm.scss';

/** Form id linking the footer submit button to the shared ReportForm. */
const NEW_BODEGA_FORM_ID = 'new-bodega-form';

interface NewBodegaFormProps {
  /** Whether the sheet is presented. */
  isOpen: boolean;
  /** Called when the sheet is dismissed (swipe-down, backdrop, or submit). */
  onDidDismiss: () => void;
}

/**
 * Bottom-sheet modal for adding a new bodega — same style as the detail sheet.
 * Reuses ReportForm with no `store`, so its name/address start blank and it
 * submits in "new" mode. Controlled by the owner via `isOpen` / `onDidDismiss`.
 */
const NewBodegaForm: React.FC<NewBodegaFormProps> = ({ isOpen, onDidDismiss }) => {
  const { t } = useTranslation();
  const modal = useRef<HTMLIonModalElement>(null);
  const [valid, setValid] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [presentToast] = useIonToast();

  return (
    <IonModal
      ref={modal}
      className="new-bodega"
      isOpen={isOpen}
      onDidDismiss={onDidDismiss}
      // Rest at breakpoint 1 so the footer (bottom of the full-height sheet
      // wrapper) lands on the real screen bottom instead of in the off-screen
      // band a <1 breakpoint translates it into. With that, expandToScroll can
      // stay on: the form scrolls in place and the submit footer stays visible.
      breakpoints={[0, 1]}
      initialBreakpoint={1}
      expandToScroll
    >
      <IonContent className="new-bodega__content">
        <div className="new-bodega__tag">{t('newBodega.tag')}</div>
        <p className="new-bodega__label">{t('newBodega.title')}</p>
        <p className="new-bodega__hint">{t('newBodega.hint')}</p>

        <ReportForm
          formId={NEW_BODEGA_FORM_ID}
          onValidityChange={setValid}
          onSubmittingChange={setSubmitting}
          onSubmitted={() => {
            presentToast({
              message: t('newBodega.submitted'),
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
          {submitting ? <IonSpinner name="dots" /> : t('newBodega.submit')}
        </button>
      </IonFooter>
    </IonModal>
  );
};

export default NewBodegaForm;
