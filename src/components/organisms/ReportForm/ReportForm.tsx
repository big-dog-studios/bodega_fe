import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useIonToast } from '@ionic/react';
import { formatReverseAddress } from '../../../lib/api';
import { enqueueSubmission } from '../../../lib/submissions';
import type { ReverseAddress, Store } from '../../../lib/types';
import HoursPicker, { deserialize, serialize, summarize, type HoursGroup } from '../HoursPicker';
import LocationPicker from '../LocationPicker';
import { useUserLocation } from '../../../context/LocationContext';
import { useUserId } from '../../../context/UserContext';
import { track } from '../../../lib/analytics';
import './ReportForm.scss';

/** Default form id so an external submit button (a sticky footer) can submit it. */
export const REPORT_FORM_ID = 'report-form';

/** Maps a feature filter key to its `POST /submissions` field name. */
const SUBMIT_FIELDS: Record<string, string> = {
  preparedFood: 'prepared_food',
  plantBased: 'plant_based',
  lottery: 'lottery',
  alcohol: 'alcohol',
  tobacco: 'tobacco',
  snap: 'snap',
};

/** The yes/no questions rendered in the form. Hardcoded — independent of the map filters. */
const QUESTIONS = [
  { key: 'preparedFood', labelKey: 'features.preparedFood', icon: '🥪' },
  { key: 'plantBased', labelKey: 'features.plantBased', icon: '🌱' },
  { key: 'lottery', labelKey: 'features.lottery', icon: '🎟' },
  { key: 'alcohol', labelKey: 'features.alcohol', icon: '🍺' },
  { key: 'tobacco', labelKey: 'features.tobacco', icon: '🚬' },
  { key: 'snap', labelKey: 'features.snap', icon: '🛒' },
  { key: 'wic', labelKey: 'features.wic', icon: '🍼' },
  { key: 'atm', labelKey: 'features.atm', icon: '🏧' },
  { key: 'cat', labelKey: 'features.catReport', icon: '🐈' },
];

const EMPTY_ADDRESS: ReverseAddress = { house: '', street: '', city: '', county: '', zip: '' };

/** Structured address parts from a store record (for report prefill). */
const addressFor = (s?: Store): ReverseAddress =>
  s
    ? { house: s.house, street: s.street, city: s.city, county: s.county, zip: s.zip }
    : EMPTY_ADDRESS;

/** Seed the hours JSON from a store record — only if its value is our format. */
const initialHours = (s?: Store): string => {
  const groups = deserialize(s?.hours_summary);
  return groups.length > 0 ? serialize(groups) : '';
};

type Answer = 'yes' | 'no';

/** Reads each question's current value off a store record (for report prefill). */
const STORE_FLAG: Record<string, (s: Store) => boolean> = {
  preparedFood: (s) => s.has_prepared_food,
  plantBased: (s) => s.has_plant_based,
  lottery: (s) => s.has_lottery,
  alcohol: (s) => s.alc_class != null,
  tobacco: (s) => s.has_tobacco,
  snap: (s) => s.has_snap,
  wic: (s) => s.has_wic,
  atm: (s) => s.has_atm,
  cat: (s) => s.has_cat,
};

/** Prefill yes/no answers from a store's flags; blank when adding a new bodega. */
const answersFor = (store?: Store): Record<string, Answer> => {
  if (!store) return {};
  const a: Record<string, Answer> = {};
  for (const q of QUESTIONS) {
    const read = STORE_FLAG[q.key];
    if (read) a[q.key] = read(store) ? 'yes' : 'no';
  }
  return a;
};

interface ReportFormProps {
  /** Existing store → prefill name/address + report mode. Omit for a new bodega. */
  store?: Store;
  /** Form id the external submit button targets (defaults to REPORT_FORM_ID). */
  formId?: string;
  /** Reports whether the form has enough to submit (drives the footer button). */
  onValidityChange?: (valid: boolean) => void;
  /** Reports in-flight state so the footer button can show a spinner. */
  onSubmittingChange?: (submitting: boolean) => void;
  /** Fired once a submission posts successfully. */
  onSubmitted?: () => void;
}

/**
 * Crowd-sourced form for a bodega — name, address, feature answers, hours, media.
 * Prefilled + report mode when `store` is given; blank + new mode otherwise. Both
 * post to the same `/submissions` endpoint (distinguished by `mode`).
 */
const ReportForm: React.FC<ReportFormProps> = ({
  store,
  formId = REPORT_FORM_ID,
  onValidityChange,
  onSubmittingChange,
  onSubmitted,
}) => {
  const isNew = !store;
  const { t } = useTranslation();
  const userLocation = useUserLocation();
  const userId = useUserId();

  const [name, setName] = useState(store ? store.display_name || store.dba : '');
  // Location is picked on a map; addr holds the reverse-geocoded structured parts.
  const [addr, setAddr] = useState<ReverseAddress>(addressFor(store));
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(
    store ? { lat: store.lat, lon: store.lon } : null,
  );
  const [locOpen, setLocOpen] = useState(false);
  const [answers, setAnswers] = useState<Record<string, Answer>>(answersFor(store));
  // `hours` holds the picker's JSON (or ''); the picker opens over the form.
  const [hours, setHours] = useState(() => initialHours(store));
  const [hoursOpen, setHoursOpen] = useState(false);
  const [receipt, setReceipt] = useState<File | null>(null);
  const [photos, setPhotos] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [presentToast] = useIonToast();

  // Surface submission errors as a red toast (matches the success toast).
  const showError = (message: string) =>
    presentToast({ message, duration: 3500, position: 'top', color: 'danger' });

  // Re-prefill if the store identity changes while the form is mounted.
  useEffect(() => {
    setName(store ? store.display_name || store.dba : '');
    setAddr(addressFor(store));
    setCoords(store ? { lat: store.lat, lon: store.lon } : null);
    setAnswers(answersFor(store));
    setHours(initialHours(store));
  }, [store?.license_number]); // eslint-disable-line react-hooks/exhaustive-deps

  const setAnswer = (key: string, value: Answer) =>
    setAnswers((prev) => ({ ...prev, [key]: value }));

  // Memoized so the array reference is stable while `hours` is unchanged — the
  // HoursPicker only re-seeds on open, but a stable prop also avoids re-parsing
  // and keeps the contract clean for any future ref-sensitive consumer.
  const hoursGroups: HoursGroup[] = useMemo(() => deserialize(hours), [hours]);
  const hoursLabel = hoursGroups.length > 0 ? summarize(hoursGroups) : '';
  const addressLabel = formatReverseAddress(addr);

  const hasReportContent =
    Object.keys(answers).length > 0 || hours.trim() !== '' || !!receipt || photos.length > 0;

  // Name + a picked location are always required; a report also needs some input.
  const hasNameLocation = name.trim() !== '' && coords != null;
  const canSubmit = !submitting && hasNameLocation && (isNew || hasReportContent);

  useEffect(() => {
    onValidityChange?.(canSubmit);
  }, [canSubmit, onValidityChange]);

  useEffect(() => {
    onSubmittingChange?.(submitting);
  }, [submitting, onSubmittingChange]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !coords) return;

    // Re-key feature answers by their API field name (e.g. preparedFood → prepared_food).
    const fields: Record<string, Answer> = {};
    for (const [key, value] of Object.entries(answers)) {
      fields[SUBMIT_FIELDS[key] ?? key] = value;
    }

    setSubmitting(true);
    try {
      // Coords come straight from the map picker (or the existing store) — no
      // geocoding needed at submit time. Queued locally first, then sent (or
      // retried later if offline), so this resolves the moment it's saved.
      await enqueueSubmission({
        mode: isNew ? 'new' : 'report',
        license_number: store?.license_number,
        name,
        address: addressLabel,
        house: addr.house,
        street: addr.street,
        city: addr.city,
        county: addr.county,
        zip: addr.zip,
        lat: coords.lat,
        lon: coords.lon,
        answers: fields,
        hours,
        receipt,
        photos,
        user_id: userId ?? undefined,
      });
      if (isNew) track('Bodega Submitted');
      else track('Report Submitted', { license_number: store?.license_number });
      // No field reset needed: the form unmounts on success (tab switch / modal
      // dismiss) and re-initializes fresh the next time it's shown.
      onSubmitted?.();
    } catch (err) {
      showError(err instanceof Error ? err.message : t('report.submitFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form id={formId} className="report-form" onSubmit={submit}>
      <label className="report-form__field">
        <span className="report-form__label">{t('report.name')}</span>
        <input
          className="report-form__input"
          type="text"
          placeholder={t('report.namePlaceholder')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </label>

      <div className="report-form__field">
        <span className="report-form__label">{t('report.location')}</span>
        <button
          type="button"
          className={`report-form__picker${addressLabel ? ' report-form__picker--set' : ''}`}
          onClick={() => setLocOpen(true)}
        >
          <span className="report-form__picker-value">{addressLabel || t('report.setLocation')}</span>
          <span className="report-form__picker-chev">›</span>
        </button>
      </div>

      <LocationPicker
        isOpen={locOpen}
        initial={coords ?? userLocation}
        onCancel={() => setLocOpen(false)}
        onSelect={({ lat, lon, house, street, city, county, zip }) => {
          setCoords({ lat, lon });
          setAddr({ house, street, city, county, zip });
          setLocOpen(false);
        }}
      />

      <p className="report-form__legend">{t('report.legend')}</p>

      <div className="report-form__rows">
        {QUESTIONS.map((f) => (
          <div key={f.key} className="report-form__row">
            <span className="report-form__feature">
              <span className="report-form__icon">{f.icon}</span>
              {t(f.labelKey)}
            </span>
            <span className="report-form__yesno">
              {(['yes', 'no'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  className={`report-form__toggle${
                    answers[f.key] === v ? ' report-form__toggle--on' : ''
                  }`}
                  onClick={() => setAnswer(f.key, v)}
                >
                  {t(`report.${v}`)}
                </button>
              ))}
            </span>
          </div>
        ))}
      </div>

      <div className="report-form__field">
        <span className="report-form__label">{t('report.hours')}</span>
        <button
          type="button"
          className={`report-form__picker${hoursLabel ? ' report-form__picker--set' : ''}`}
          onClick={() => setHoursOpen(true)}
        >
          <span className="report-form__picker-value">{hoursLabel || t('report.setHours')}</span>
          <span className="report-form__picker-chev">›</span>
        </button>
      </div>

      <HoursPicker
        isOpen={hoursOpen}
        initialGroups={hoursGroups}
        onCancel={() => setHoursOpen(false)}
        onSave={(groups) => {
          setHours(serialize(groups));
          setHoursOpen(false);
        }}
      />

      <div className="report-form__field">
        <span className="report-form__label">{t('report.receiptLabel')}</span>
        <span className="report-form__hint">{t('report.receiptHint')}</span>
        <label className="report-form__drop">
          <input
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => setReceipt(e.target.files?.[0] ?? null)}
          />
          {receipt ? t('report.receiptAdded') : t('report.receiptChoose')}
        </label>
      </div>

      <div className="report-form__field">
        <span className="report-form__label">{t('report.photosLabel')}</span>
        <span className="report-form__hint">{t('report.photosHint')}</span>
        <label className="report-form__drop">
          <input
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => setPhotos(e.target.files ? Array.from(e.target.files) : [])}
          />
          {photos.length
            ? t('report.photosAdded', { count: photos.length })
            : t('report.photosChoose')}
        </label>
      </div>
    </form>
  );
};

export default ReportForm;
