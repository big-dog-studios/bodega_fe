import { useState } from 'react';
import {
  IonContent,
  IonFooter,
  IonModal,
  IonSpinner,
  useIonActionSheet,
  useIonAlert,
  useIonToast,
} from '@ionic/react';
import { Capacitor } from '@capacitor/core';
import { useStores } from '../../../context/StoresContext';
import { useFavorites } from '../../../context/FavoritesContext';
import { submitReport, type StoreDetail } from '../../../lib/api';
import { track } from '../../../lib/analytics';
import FeatureBadge from '../../atoms/FeatureBadge';
import ProductsTab from '../../molecules/ProductsTab';
import ReportForm, { REPORT_FORM_ID } from '../ReportForm';
import './StoreDetailSheet.scss';

type TabKey = 'info' | 'products' | 'report';

/** Feature flags -> badges. `filled` is the bold red treatment. */
const BADGES: { test: (s: StoreDetail) => boolean; label: string; filled?: boolean }[] = [
  { test: (s) => s.has_prepared_food, label: 'HOT FOOD' },
  { test: (s) => s.has_tobacco, label: 'TOBACCO' },
  { test: (s) => s.has_lottery, label: 'LOTTERY' },
  { test: (s) => s.alc_class != null, label: 'BEER & WINE' },
  { test: (s) => s.has_snap, label: 'SNAP/EBT' },
  { test: (s) => s.has_quick_draw, label: 'QUICK DRAW' },
  { test: (s) => s.has_atm, label: 'ATM' },
  { test: (s) => s.has_cat, label: '🐈' },
  { test: (s) => s.takeout === true, label: 'TAKEOUT' },
  { test: (s) => s.delivery === true, label: 'DELIVERY' },
];

/** Payment methods -> badge. Nullable; only shown when explicitly true. */
const PAYMENTS: { test: (s: StoreDetail) => boolean; label: string }[] = [
  { test: (s) => s.accepts_credit_cards === true, label: '💳 CREDIT' },
  { test: (s) => s.accepts_debit_cards === true, label: '🏧 DEBIT' },
  { test: (s) => s.accepts_cash_only === true, label: '💵 CASH ONLY' },
  { test: (s) => s.accepts_nfc === true, label: '📲 TAP TO PAY' },
];

/** Bottom-sheet drawer for the selected store. Opens on pin select. */
const StoreDetailSheet: React.FC = () => {
  const { selectedId, selected, selectedLoading, clearSelected, products } = useStores();
  const { isFavorite, toggleFavorite } = useFavorites();
  const [tab, setTab] = useState<TabKey>('info');
  const [reportValid, setReportValid] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [presentToast] = useIonToast();
  const [presentActionSheet] = useIonActionSheet();
  const [presentAlert] = useIonAlert();

  // Products tab only exists when this store returned a catalog.
  const hasProducts = products.length > 0;
  const tabs: { key: TabKey; icon: string; label: string }[] = [
    { key: 'info', icon: '📍', label: 'Info' },
    ...(hasProducts ? [{ key: 'products' as const, icon: '🛒', label: 'Products' }] : []),
    { key: 'report', icon: '✏️', label: 'Report' },
  ];
  // Fall back to Info if the active tab isn't available for this store.
  const activeTab: TabKey = tab === 'products' && !hasProducts ? 'info' : tab;

  const dismiss = () => {
    clearSelected();
    setTab('info');
  };

  // Flag the store as a false/closed listing via the same /submissions endpoint
  // (mode: 'delete'). Confirm first since it asks us to remove the pin.
  const reportFalse = () => {
    if (!selected) return;
    const name = selected.display_name || selected.dba;
    presentAlert({
      header: 'Not a real bodega?',
      message: `Report “${name}” as a false or closed listing. We'll review it.`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Report',
          role: 'destructive',
          handler: () => {
            void submitReport({
              mode: 'delete',
              license_number: selected.license_number,
              name,
              address: '',
              answers: {},
            })
              .then(() => {
                track('False Bodega Reported', { license_number: selected.license_number });
                presentToast({
                  message: "Thanks — we'll review this listing.",
                  duration: 2500,
                  position: 'top',
                  color: 'success',
                });
                dismiss();
              })
              .catch(() => {
                presentToast({
                  message: "Couldn't submit. Please try again.",
                  duration: 3000,
                  position: 'top',
                  color: 'danger',
                });
              });
          },
        },
      ],
    });
  };

  const selectTab = (key: TabKey) => {
    if (key === 'products' && selected) {
      track('Products Viewed', {
        license_number: selected.license_number,
        product_count: products.length,
      });
    }
    setTab(key);
  };

  // Let the user pick their maps app. Options are platform-aware: Apple Maps only
  // where it exists (iOS/desktop), and an Android "default app" option via a geo:
  // URI that triggers the system maps chooser (Google, Waze, whatever they have).
  const openDirections = () => {
    if (!selected) return;
    const dest = `${selected.lat},${selected.lon}`;
    const label = selected.dba ? `(${encodeURIComponent(selected.dba)})` : '';
    const open = (url: string) => {
      // Custom schemes (geo:) need a top-level navigation to hand off to the OS;
      // http(s) links open in a new tab / their associated native app.
      if (/^https?:/.test(url)) window.open(url, '_blank');
      else window.location.href = url;
    };

    const go = (app: string, url: string) => {
      track('Directions Opened', { app, license_number: selected.license_number });
      open(url);
    };
    const appleMaps = {
      text: 'Apple Maps',
      handler: () => go('apple', `https://maps.apple.com/?daddr=${dest}`),
    };
    const googleMaps = {
      text: 'Google Maps',
      handler: () => go('google', `https://www.google.com/maps/dir/?api=1&destination=${dest}`),
    };
    const defaultApp = {
      text: 'Default maps app',
      handler: () => go('default', `geo:${dest}?q=${dest}${label}`),
    };
    const cancel = { text: 'Cancel', role: 'cancel' as const };

    const platform = Capacitor.getPlatform();
    const buttons =
      platform === 'ios'
        ? [appleMaps, googleMaps, cancel]
        : platform === 'android'
          ? [defaultApp, googleMaps, cancel]
          : [googleMaps, appleMaps, cancel];

    presentActionSheet({ header: 'Get directions', buttons });
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
            {tabs.map((tb) => (
              <button
                key={tb.key}
                type="button"
                className={`store-sheet__tab${activeTab === tb.key ? ' store-sheet__tab--active' : ''}`}
                onClick={() => selectTab(tb.key)}
              >
                <span className="store-sheet__tab-icon">{tb.icon}</span>
                {tb.label}
              </button>
            ))}
          </div>
        )}

        {selected && activeTab === 'products' && <ProductsTab products={products} />}

        {selected && activeTab === 'info' && (
          <div className="store-sheet__body">
            <header className="store-sheet__head">
              <div className="store-sheet__name-row">
                <h1 className="store-sheet__name">{selected.display_name || selected.dba}</h1>
                <button
                  type="button"
                  className={`store-sheet__fav${
                    isFavorite(selected.license_number) ? ' store-sheet__fav--on' : ''
                  }`}
                  aria-label="Favorite"
                  aria-pressed={isFavorite(selected.license_number)}
                  onClick={() =>
                    toggleFavorite({
                      license_number: selected.license_number,
                      name: selected.display_name || selected.dba,
                      lat: selected.lat,
                      lon: selected.lon,
                    })
                  }
                >
                  {isFavorite(selected.license_number) ? '★' : '☆'}
                </button>
              </div>
              {selected.city && <p className="store-sheet__area">{selected.city}</p>}
              <p className="store-sheet__area">
                {selected.house} {selected.street}, {selected.county}, NY {selected.zip}
              </p>
              {selected.rating != null && (
                <p className="store-sheet__rating">★ {selected.rating.toFixed(1)}</p>
              )}
            </header>

            <section className="store-sheet__section">
              <p className="store-sheet__label">FEATURES</p>
              <div className="store-sheet__badges">
                {BADGES.filter((b) => b.test(selected)).map((b) => (
                  <FeatureBadge key={b.label} label={b.label} filled={b.filled} />
                ))}
              </div>
            </section>

            {PAYMENTS.some((p) => p.test(selected)) && (
              <section className="store-sheet__section">
                <p className="store-sheet__label">ACCEPTS</p>
                <div className="store-sheet__badges">
                  {PAYMENTS.filter((p) => p.test(selected)).map((p) => (
                    <FeatureBadge key={p.label} label={p.label} />
                  ))}
                </div>
              </section>
            )}

            {selected.hours_summary && (
              <section className="store-sheet__section">
                <div className="store-sheet__hours">
                  {selected.hours_summary.split(',').map((line) => (
                    <p key={line}>{line.trim()}</p>
                  ))}
                </div>
              </section>
            )}

            <button type="button" className="store-sheet__report-false" onClick={reportFalse}>
              🚩 Not a real bodega? Report it
            </button>
          </div>
        )}

        {selected && activeTab === 'report' && (
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

      {selected && activeTab !== 'products' && (
        <IonFooter className="store-sheet__footer">
          {activeTab === 'report' ? (
            <button
              type="submit"
              form={REPORT_FORM_ID}
              className="store-sheet__submit"
              disabled={!reportValid || submitting}
            >
              {submitting ? <IonSpinner name="dots" /> : 'SUBMIT REPORT'}
            </button>
          ) : (
            <div className="store-sheet__actions">
              {selected.phone && (
                <a
                  className="store-sheet__call"
                  href={`tel:${selected.phone}`}
                  onClick={() => track('Call Tapped', { license_number: selected.license_number })}
                >
                  CALL
                </a>
              )}
              <button type="button" className="store-sheet__directions" onClick={openDirections}>
                DIRECTIONS
              </button>
            </div>
          )}
        </IonFooter>
      )}
    </IonModal>
  );
};

export default StoreDetailSheet;
