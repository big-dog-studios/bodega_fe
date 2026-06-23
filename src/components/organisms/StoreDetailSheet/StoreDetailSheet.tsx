import { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import { useUserId } from '../../../context/UserContext';
import { enqueueSubmission } from '../../../lib/submissions';
import type { Store } from '../../../lib/types';
import { track } from '../../../lib/analytics';
import FeatureBadge from '../../atoms/FeatureBadge';
import ProductsTab from '../../molecules/ProductsTab';
import WalkTimeTag from '../../molecules/WalkTimeTag';
import ReportForm, { REPORT_FORM_ID } from '../ReportForm';
import './StoreDetailSheet.scss';

type TabKey = 'info' | 'products' | 'report';

/** Feature flags -> badges. `labelKey` is an i18n key; `filled` is the bold red treatment. */
const BADGES: { test: (s: Store) => boolean; labelKey: string; filled?: boolean }[] = [
  { test: (s) => s.has_prepared_food, labelKey: 'features.preparedFood' },
  { test: (s) => s.has_tobacco, labelKey: 'features.tobacco' },
  { test: (s) => s.has_lottery, labelKey: 'features.lottery' },
  { test: (s) => s.alc_class != null, labelKey: 'features.alcohol' },
  { test: (s) => s.has_snap, labelKey: 'features.snap' },
  { test: (s) => s.has_wic, labelKey: 'features.wic' },
  { test: (s) => s.has_quick_draw, labelKey: 'features.quickDraw' },
  { test: (s) => s.has_atm, labelKey: 'features.atm' },
  { test: (s) => s.has_cat, labelKey: 'features.catBadge' },
  { test: (s) => s.takeout === true, labelKey: 'features.takeout' },
  { test: (s) => s.delivery === true, labelKey: 'features.delivery' },
];

/** Payment methods -> badge. Nullable; only shown when explicitly true. */
const PAYMENTS: { test: (s: Store) => boolean; labelKey: string }[] = [
  { test: (s) => s.accepts_credit_cards === true, labelKey: 'payments.credit' },
  { test: (s) => s.accepts_debit_cards === true, labelKey: 'payments.debit' },
  { test: (s) => s.accepts_cash_only === true, labelKey: 'payments.cashOnly' },
  { test: (s) => s.accepts_nfc === true, labelKey: 'payments.nfc' },
];

/** Bottom-sheet drawer for the selected store. Opens on pin select. */
const StoreDetailSheet: React.FC = () => {
  const { t } = useTranslation();
  const { selectedId, selected, selectedLoading, clearSelected, products } = useStores();
  const { isFavorite, toggleFavorite } = useFavorites();
  const userId = useUserId();
  const [tab, setTab] = useState<TabKey>('info');
  const [reportValid, setReportValid] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [presentToast] = useIonToast();
  const [presentActionSheet] = useIonActionSheet();
  const [presentAlert] = useIonAlert();

  // Products tab only exists when this store returned a catalog.
  const hasProducts = products.length > 0;
  const tabs: { key: TabKey; icon: string; label: string }[] = [
    { key: 'info', icon: '📍', label: t('detail.tabInfo') },
    ...(hasProducts ? [{ key: 'products' as const, icon: '🛒', label: t('detail.tabProducts') }] : []),
    { key: 'report', icon: '✏️', label: t('detail.tabReport') },
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
      header: t('detail.falseHeader'),
      message: t('detail.falseMessage', { name }),
      buttons: [
        { text: t('common.cancel'), role: 'cancel' },
        {
          text: t('detail.falseConfirm'),
          role: 'destructive',
          handler: () => {
            void enqueueSubmission({
              mode: 'delete',
              license_number: selected.license_number,
              name,
              address: '',
              answers: {},
              user_id: userId ?? undefined,
            })
              .then(() => {
                track('False Bodega Reported', { license_number: selected.license_number });
                presentToast({
                  message: t('detail.falseThanks'),
                  duration: 2500,
                  position: 'top',
                  color: 'success',
                });
                dismiss();
              })
              .catch(() => {
                presentToast({
                  message: t('common.submitError'),
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
      text: t('detail.appleMaps'),
      handler: () => go('apple', `https://maps.apple.com/?daddr=${dest}`),
    };
    const googleMaps = {
      text: t('detail.googleMaps'),
      handler: () => go('google', `https://www.google.com/maps/dir/?api=1&destination=${dest}`),
    };
    const defaultApp = {
      text: t('detail.defaultMaps'),
      handler: () => go('default', `geo:${dest}?q=${dest}${label}`),
    };
    const cancel = { text: t('common.cancel'), role: 'cancel' as const };

    const platform = Capacitor.getPlatform();
    const buttons =
      platform === 'ios'
        ? [appleMaps, googleMaps, cancel]
        : platform === 'android'
          ? [defaultApp, googleMaps, cancel]
          : [googleMaps, appleMaps, cancel];

    presentActionSheet({ header: t('detail.getDirections'), buttons });
  };

  return (
    <IonModal
      className="store-sheet"
      isOpen={selectedId !== null}
      onDidDismiss={dismiss}
      // A sheet modal is a full-screen wrapper translated DOWN by (1 - breakpoint)
      // of the viewport, with the footer pinned to the wrapper's bottom. So the
      // footer only sits at the real screen bottom when the resting breakpoint is
      // exactly 1 — any lower (e.g. 0.9) pushes the footer + last content off
      // screen. That is the cutoff we kept fighting. Resting at 1 lets us keep
      // expandToScroll on: content scrolls in place, footer stays visible, and
      // nothing overlaps. The 0.6 detent is a drag-down peek at the map.
      breakpoints={[0, 0.6, 1]}
      initialBreakpoint={1}
      expandToScroll
    >
      <IonContent className="store-sheet__content">
        <div className="store-sheet__tag">{t('detail.tag')}</div>

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
                  aria-label={t('detail.favoriteAria')}
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
              <div className="store-sheet__rating-row">
                {selected.rating != null && (
                  <p className="store-sheet__rating">★ {selected.rating.toFixed(1)}</p>
                )}
                <WalkTimeTag lat={selected.lat} lon={selected.lon} />
              </div>
            </header>

            <section className="store-sheet__section">
              <p className="store-sheet__label">{t('detail.featuresLabel')}</p>
              <div className="store-sheet__badges">
                {BADGES.filter((b) => b.test(selected)).map((b) => (
                  <FeatureBadge key={b.labelKey} label={t(b.labelKey)} filled={b.filled} />
                ))}
              </div>
            </section>

            {PAYMENTS.some((p) => p.test(selected)) && (
              <section className="store-sheet__section">
                <p className="store-sheet__label">{t('detail.acceptsLabel')}</p>
                <div className="store-sheet__badges">
                  {PAYMENTS.filter((p) => p.test(selected)).map((p) => (
                    <FeatureBadge key={p.labelKey} label={t(p.labelKey)} />
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
              {t('detail.reportFalse')}
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
                message: t('detail.reportSubmitted'),
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
              {submitting ? <IonSpinner name="dots" /> : t('detail.submitReport')}
            </button>
          ) : (
            <div className="store-sheet__actions">
              {selected.phone && (
                <a
                  className="store-sheet__call"
                  href={`tel:${selected.phone}`}
                  onClick={() => track('Call Tapped', { license_number: selected.license_number })}
                >
                  {t('detail.call')}
                </a>
              )}
              <button type="button" className="store-sheet__directions" onClick={openDirections}>
                {t('detail.directions')}
              </button>
            </div>
          )}
        </IonFooter>
      )}
    </IonModal>
  );
};

export default StoreDetailSheet;
