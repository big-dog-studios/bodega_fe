import { useEffect, useState } from 'react';
import { STORE_FILTERS } from '../../molecules/FilterBar';
import type { StoreDetail } from '../../../lib/api';
import './ReportForm.scss';

/** Form id so an external submit button (the sticky footer) can submit it. */
export const REPORT_FORM_ID = 'report-form';

interface ReportFormProps {
  store: StoreDetail;
  /** Reports whether the form has enough to submit (drives the footer button). */
  onValidityChange?: (valid: boolean) => void;
}

type Answer = 'yes' | 'no';

/** Crowd-sourced report form for a store — feature answers, hours, and media. */
const ReportForm: React.FC<ReportFormProps> = ({ store, onValidityChange }) => {
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [hours, setHours] = useState('');
  const [receipt, setReceipt] = useState<File | null>(null);
  const [photos, setPhotos] = useState<File[]>([]);

  const setAnswer = (key: string, value: Answer) =>
    setAnswers((prev) => ({ ...prev, [key]: value }));

  const canSubmit =
    Object.keys(answers).length > 0 ||
    hours.trim() !== '' ||
    !!receipt ||
    photos.length > 0;

  useEffect(() => {
    onValidityChange?.(canSubmit);
  }, [canSubmit, onValidityChange]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    // TODO: POST the report to the API.
    console.log('report', {
      license_number: store.license_number,
      answers,
      hours,
      receipt,
      photos,
    });
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
    </form>
  );
};

export default ReportForm;
