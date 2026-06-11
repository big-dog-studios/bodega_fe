import { useEffect, useState } from 'react';
import { STORE_FILTERS } from '../../molecules/FilterBar';
import { submitReport, type StoreDetail } from '../../../lib/api';
import './ReportForm.scss';

/** Form id so an external submit button (the sticky footer) can submit it. */
export const REPORT_FORM_ID = 'report-form';

/** Maps a feature filter key to its `POST /submissions` field name. */
const SUBMIT_FIELDS: Record<string, string> = {
  preparedFood: 'prepared_food',
  lottery: 'lottery',
  alcohol: 'alcohol',
  tobacco: 'tobacco',
};

interface ReportFormProps {
  store: StoreDetail;
  /** Reports whether the form has enough to submit (drives the footer button). */
  onValidityChange?: (valid: boolean) => void;
  /** Reports in-flight state so the footer button can show a spinner. */
  onSubmittingChange?: (submitting: boolean) => void;
  /** Fired once a report posts successfully. */
  onSubmitted?: () => void;
}

type Answer = 'yes' | 'no';

/** Crowd-sourced report form for a store — feature answers, hours, and media. */
const ReportForm: React.FC<ReportFormProps> = ({
  store,
  onValidityChange,
  onSubmittingChange,
  onSubmitted,
}) => {
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [hours, setHours] = useState('');
  const [receipt, setReceipt] = useState<File | null>(null);
  const [photos, setPhotos] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setAnswer = (key: string, value: Answer) =>
    setAnswers((prev) => ({ ...prev, [key]: value }));

  const canSubmit =
    !submitting &&
    (Object.keys(answers).length > 0 ||
      hours.trim() !== '' ||
      !!receipt ||
      photos.length > 0);

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
      await submitReport({
        license_number: store.license_number,
        answers: fields,
        hours,
        receipt,
        photos,
      });
      setAnswers({});
      setHours('');
      setReceipt(null);
      setPhotos([]);
      onSubmitted?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form id={REPORT_FORM_ID} className="report-form" onSubmit={submit}>
      <p className="report-form__legend">Does this bodega have…</p>

      <div className="report-form__rows">
        {STORE_FILTERS.map((f) => (
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

      <label className="report-form__field">
        <span className="report-form__label">Correct hours</span>
        <input
          className="report-form__input"
          type="text"
          placeholder="e.g. Mon–Sun 6AM–11PM"
          value={hours}
          onChange={(e) => setHours(e.target.value)}
        />
      </label>

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
