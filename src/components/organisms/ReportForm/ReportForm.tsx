import { useEffect, useState } from 'react';
import { geocodeAddress, submitReport, type StoreDetail } from '../../../lib/api';
import HoursPicker, { deserialize, serialize, summarize, type HoursGroup } from '../HoursPicker';
import './ReportForm.scss';

/** Default form id so an external submit button (a sticky footer) can submit it. */
export const REPORT_FORM_ID = 'report-form';

/** Maps a feature filter key to its `POST /submissions` field name. */
const SUBMIT_FIELDS: Record<string, string> = {
  preparedFood: 'prepared_food',
  lottery: 'lottery',
  alcohol: 'alcohol',
  tobacco: 'tobacco',
  snap: 'snap',
};

/** The yes/no questions rendered in the form. Hardcoded — independent of the map filters. */
const QUESTIONS = [
  { key: 'preparedFood', label: 'HOT FOOD', icon: '🥪' },
  { key: 'lottery', label: 'LOTTERY', icon: '🎟' },
  { key: 'alcohol', label: 'BEER & WINE', icon: '🍺' },
  { key: 'tobacco', label: 'TOBACCO', icon: '🚬' },
  { key: 'snap', label: 'SNAP/EBT', icon: '🛒' },
  { key: 'atm', label: 'ATM', icon: '🏧' },
  { key: 'cat', label: 'BODEGA CAT', icon: '🐈' },
];

/** Single-line address string from a store record. */
const formatAddress = (s: StoreDetail) =>
  `${s.house} ${s.street}, ${s.county}, NY ${s.zip}`;

/** Seed the hours JSON from a store record — only if its value is our format. */
const initialHours = (s?: StoreDetail): string => {
  const groups = deserialize(s?.hours_summary);
  return groups.length > 0 ? serialize(groups) : '';
};

type Answer = 'yes' | 'no';

/** Reads each question's current value off a store record (for report prefill). */
const STORE_FLAG: Record<string, (s: StoreDetail) => boolean> = {
  preparedFood: (s) => s.has_prepared_food,
  lottery: (s) => s.has_lottery,
  alcohol: (s) => s.alc_class != null,
  tobacco: (s) => s.has_tobacco,
  snap: (s) => s.has_snap,
  atm: (s) => s.has_atm,
  cat: (s) => s.has_cat,
};

/** Prefill yes/no answers from a store's flags; blank when adding a new bodega. */
const answersFor = (store?: StoreDetail): Record<string, Answer> => {
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
  store?: StoreDetail;
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

  const [name, setName] = useState(store ? store.display_name || store.dba : '');
  const [address, setAddress] = useState(store ? formatAddress(store) : '');
  const [answers, setAnswers] = useState<Record<string, Answer>>(answersFor(store));
  // `hours` holds the picker's JSON (or ''); the picker opens over the form.
  const [hours, setHours] = useState(() => initialHours(store));
  const [hoursOpen, setHoursOpen] = useState(false);
  const [receipt, setReceipt] = useState<File | null>(null);
  const [photos, setPhotos] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-prefill if the store identity changes while the form is mounted.
  useEffect(() => {
    setName(store ? store.display_name || store.dba : '');
    setAddress(store ? formatAddress(store) : '');
    setAnswers(answersFor(store));
    setHours(initialHours(store));
  }, [store?.license_number]); // eslint-disable-line react-hooks/exhaustive-deps

  const setAnswer = (key: string, value: Answer) =>
    setAnswers((prev) => ({ ...prev, [key]: value }));

  const hoursGroups: HoursGroup[] = deserialize(hours);
  const hoursLabel = hoursGroups.length > 0 ? summarize(hoursGroups) : '';

  const hasReportContent =
    Object.keys(answers).length > 0 || hours.trim() !== '' || !!receipt || photos.length > 0;

  // Name + address are always required; a report also needs some actual input.
  const hasNameAddress = name.trim() !== '' && address.trim() !== '';
  const canSubmit = !submitting && hasNameAddress && (isNew || hasReportContent);

  useEffect(() => {
    onValidityChange?.(canSubmit);
  }, [canSubmit, onValidityChange]);

  useEffect(() => {
    onSubmittingChange?.(submitting);
  }, [submitting, onSubmittingChange]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    // Re-key feature answers by their API field name (e.g. preparedFood → prepared_food).
    const fields: Record<string, Answer> = {};
    for (const [key, value] of Object.entries(answers)) {
      fields[SUBMIT_FIELDS[key] ?? key] = value;
    }

    setSubmitting(true);
    setError(null);
    try {
      // Existing stores already have coords; a new bodega is geocoded from its
      // typed address (no coords = nothing to put on the map, so block submit).
      let lat = store?.lat;
      let lon = store?.lon;
      if (isNew) {
        // Try name + address first (matches the store's OSM POI when it exists,
        // which is more precise), then fall back to the address alone.
        const geo =
          (await geocodeAddress(`${name}, ${address}`)) ?? (await geocodeAddress(address));
        if (!geo) {
          setError("Couldn't find that address — please check it and try again.");
          setSubmitting(false);
          return;
        }
        lat = geo.lat;
        lon = geo.lon;
      }

      await submitReport({
        mode: isNew ? 'new' : 'report',
        license_number: store?.license_number,
        name,
        address,
        lat,
        lon,
        answers: fields,
        hours,
        receipt,
        photos,
      });
      // No field reset needed: the form unmounts on success (tab switch / modal
      // dismiss) and re-initializes fresh the next time it's shown.
      onSubmitted?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form id={formId} className="report-form" onSubmit={submit}>
      <label className="report-form__field">
        <span className="report-form__label">Name</span>
        <input
          className="report-form__input"
          type="text"
          placeholder="Bodega name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </label>

      <label className="report-form__field">
        <span className="report-form__label">Address</span>
        <input
          className="report-form__input"
          type="text"
          placeholder="123 Main St, Brooklyn, NY 11211"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          required
        />
      </label>

      <p className="report-form__legend">Does this bodega have…</p>

      <div className="report-form__rows">
        {QUESTIONS.map((f) => (
          <div key={f.key} className="report-form__row">
            <span className="report-form__feature">
              <span className="report-form__icon">{f.icon}</span>
              {f.label}
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
                  {v}
                </button>
              ))}
            </span>
          </div>
        ))}
      </div>

      <div className="report-form__field">
        <span className="report-form__label">Hours</span>
        <button
          type="button"
          className={`report-form__hours${hoursLabel ? ' report-form__hours--set' : ''}`}
          onClick={() => setHoursOpen(true)}
        >
          <span className="report-form__hours-value">{hoursLabel || 'Set hours'}</span>
          <span className="report-form__hours-chev">›</span>
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
        <span className="report-form__label">Upload a receipt</span>
        <span className="report-form__hint">Help us verify what this bodega sells</span>
        <label className="report-form__drop">
          <input
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => setReceipt(e.target.files?.[0] ?? null)}
          />
          {receipt ? '✓ Receipt added' : '📷 Choose photo'}
        </label>
      </div>

      <div className="report-form__field">
        <span className="report-form__label">Upload photos</span>
        <span className="report-form__hint">Show us the bodega — storefront, shelves, fridges</span>
        <label className="report-form__drop">
          <input
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => setPhotos(e.target.files ? Array.from(e.target.files) : [])}
          />
          {photos.length
            ? `✓ ${photos.length} photo${photos.length > 1 ? 's' : ''} added`
            : '📸 Choose photos'}
        </label>
      </div>

      {error && <p className="report-form__error">{error}</p>}
    </form>
  );
};

export default ReportForm;
