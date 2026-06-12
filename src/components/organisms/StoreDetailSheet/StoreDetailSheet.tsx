import { useState } from 'react';
import { IonContent, IonFooter, IonModal, IonSpinner, useIonToast } from '@ionic/react';
import { Capacitor } from '@capacitor/core';
import { useStores } from '../../../context/StoresContext';
import type { StoreDetail } from '../../../lib/api';
import FeatureBadge from '../../atoms/FeatureBadge';
import ReportForm, { REPORT_FORM_ID } from '../ReportForm';
import './StoreDetailSheet.scss';

const TABS = [
  { key: 'info', icon: '📍', label: 'Info' },
  { key: 'report', icon: '✏️', label: 'Report' },
] as const;
type TabKey = (typeof TABS)[number]['key'];

/** Feature flags -> badges. `filled` is the bold red treatment. */
const BADGES: { test: (s: StoreDetail) => boolean; label: string; filled?: boolean }[] = [
  { test: (s) => s.has_prepared_food, label: 'HOT FOOD' },
  { test: (s) => s.has_tobacco, label: 'TOBACCO' },
  { test: (s) => s.has_lottery, label: 'LOTTERY' },
  { test: (s) => s.alc_class != null, label: 'BEER & WINE' },
  { test: (s) => s.has_snap, label: 'SNAP/EBT' },
  { test: (s) => s.has_quick_draw, label: 'QUICK DRAW' },
  { test: (s) => s.has_atm, label: 'ATM' },
];

/** Bottom-sheet drawer for the selected store. Opens on pin select. */
const StoreDetailSheet: React.FC = () => {
  const { selectedId, selected, selectedLoading, clearSelected } = useStores();
  const [tab, setTab] = useState<TabKey>('info');
  const [reportValid, setReportValid] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [presentToast] = useIonToast();

  const dismiss = () => {
    clearSelected();
    setTab('info');
  };

  const openDirections = () => {
    if (!selected) return;
    const dest = `${selected.lat},${selected.lon}`;
    const isIOS =
      Capacitor.getPlatform() === 'ios' || /iPad|iPhone|iPod/.test(navigator.userAgent);
    const url = isIOS
      ? `https://maps.apple.com/?daddr=${dest}`
      : `https://www.google.com/maps/dir/?api=1&destination=${dest}`;
    window.open(url, '_blank');
  };

  return (
    <IonModal
      className="store-sheet"
      isOpen={selectedId !== null}
      onDidDismiss={dismiss}
      breakpoints={[0, 0.6, 0.9]}
      initialBreakpoint={0.6}
      expandToScroll={false}
    >
      <IonContent className="store-sheet__content">
        <div className="store-sheet__tag">BODEGA</div>

        {selectedLoading && !selected && (
          <div className="store-sheet__loading">
            <IonSpinner name="crescent" />
          </div>
        )}

        {selected && (
          <div className="store-sheet__tabs">
            {TABS.map((tb) => (
              <button
                key={tb.key}
                type="button"
                className={`store-sheet__tab${tab === tb.key ? ' store-sheet__tab--active' : ''}`}
                onClick={() => setTab(tb.key)}
              >
                <span className="store-sheet__tab-icon">{tb.icon}</span>
                {tb.label}
              </button>
            ))}
          </div>
        )}

        {selected && tab === 'info' && (
          <div className="store-sheet__body">
            <header className="store-sheet__head">
              <h1 className="store-sheet__name">{selected.dba}</h1>
              {selected.city && <p className="store-sheet__area">{selected.city}</p>}
            </header>

            <section className="store-sheet__section">
              <p className="store-sheet__address">
                {selected.house} {selected.street}, {selected.county}, NY {selected.zip}
              </p>
              <div className="store-sheet__badges">
                {BADGES.filter((b) => b.test(selected)).map((b) => (
                  <FeatureBadge key={b.label} label={b.label} filled={b.filled} />
                ))}
              </div>
            </section>
          </div>
        )}

        {selected && tab === 'report' && (
          <ReportForm
            store={selected}
            onValidityChange={setReportValid}
            onSubmittingChange={setSubmitting}
            onSubmitted={() => {
              presentToast({
                message: 'Thanks! Your report was submitted.',
                duration: 2500,
                position: 'top',
                color: 'success',
              });
              setTab('info');
            }}
          />
        )}
      </IonContent>

      {selected && (
        <IonFooter className="store-sheet__footer">
          {tab === 'info' ? (
            <button type="button" className="store-sheet__directions" onClick={openDirections}>
              DIRECTIONS
            </button>
          ) : (
            <button
              type="submit"
              form={REPORT_FORM_ID}
              className="store-sheet__submit"
              disabled={!reportValid || submitting}
            >
              {submitting ? <IonSpinner name="dots" /> : 'SUBMIT REPORT'}
            </button>
          )}
        </IonFooter>
      )}
    </IonModal>
  );
};

export default StoreDetailSheet;
