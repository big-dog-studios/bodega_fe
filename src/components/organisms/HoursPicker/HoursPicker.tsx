import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IonContent, IonModal } from '@ionic/react';
import HoursDial from './HoursDial';
import {
  DAY_KEYS,
  dayLabel,
  formatDays,
  formatGroupHours,
  formatTime,
  type HoursGroup,
  type HoursMode,
} from './hours';
import './HoursPicker.scss';

/** Working copy of a group with a stable id so summary rows can be re-edited. */
interface DraftGroup extends HoursGroup {
  id: number;
}

interface PendingHours {
  open: number;
  close: number;
  mode: HoursMode;
}

const DEFAULT_PENDING: PendingHours = { open: 540, close: 1260, mode: 'hours' }; // 9:00 AM – 9:00 PM

interface HoursPickerProps {
  isOpen: boolean;
  /** Groups to start from (e.g. parsed from an existing value). */
  initialGroups?: HoursGroup[];
  onCancel: () => void;
  /** Fired with the finished groups when the user saves. */
  onSave: (groups: HoursGroup[]) => void;
}

/**
 * Full-screen modal for setting a store's weekly hours. The user selects one or
 * more days, dials in an open/close window (or marks 24h / closed), and commits
 * that as a group; repeat for the rest of the week. Saving returns the groups,
 * which the form serializes to JSON.
 */
const HoursPicker: React.FC<HoursPickerProps> = ({ isOpen, initialGroups, onCancel, onSave }) => {
  const { t } = useTranslation();
  const [groups, setGroups] = useState<DraftGroup[]>([]);
  const [nextId, setNextId] = useState(1);
  // Days currently being edited (empty = nothing selected, dial hidden).
  const [selection, setSelection] = useState<number[]>([]);
  const [pending, setPending] = useState<PendingHours>(DEFAULT_PENDING);

  // Seed the working state only when the modal opens. We deliberately ignore
  // later `initialGroups` changes: the parent re-derives that array on every
  // render (and re-renders on every live-location update), so depending on it
  // would wipe your in-progress edits on each tick.
  useEffect(() => {
    if (!isOpen) return;
    const seeded = (initialGroups ?? []).map((g, i) => ({ ...g, id: i + 1 }));
    setGroups(seeded);
    setNextId(seeded.length + 1);
    setSelection([]);
    setPending(DEFAULT_PENDING);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  /** Days already committed to a group. */
  const assigned = new Set(groups.flatMap((g) => g.days));
  const allDaysSet = assigned.size === 7;
  // Save only once every day has a schedule and nothing is mid-edit.
  const canSave = allDaysSet && selection.length === 0;

  const toggleDay = (day: number) => {
    if (selection.includes(day)) {
      setSelection((s) => s.filter((d) => d !== day));
      return;
    }
    // Pull the day out of any group it belongs to, adopting that group's hours.
    const owner = groups.find((g) => g.days.includes(day));
    if (owner) {
      setGroups((gs) =>
        gs
          .map((g) => (g.id === owner.id ? { ...g, days: g.days.filter((d) => d !== day) } : g))
          .filter((g) => g.days.length > 0),
      );
      setPending({
        open: owner.open ?? DEFAULT_PENDING.open,
        close: owner.close ?? DEFAULT_PENDING.close,
        mode: owner.mode,
      });
    }
    setSelection((s) => [...s, day]);
  };

  const commitSelection = () => {
    if (selection.length === 0) return;
    const group: DraftGroup =
      pending.mode === 'hours'
        ? { id: nextId, days: [...selection], mode: 'hours', open: pending.open, close: pending.close }
        : { id: nextId, days: [...selection], mode: pending.mode };
    setGroups((gs) => [...gs, group]);
    setNextId((n) => n + 1);
    setSelection([]);
    setPending(DEFAULT_PENDING);
  };

  const editGroup = (group: DraftGroup) => {
    setPending({
      open: group.open ?? DEFAULT_PENDING.open,
      close: group.close ?? DEFAULT_PENDING.close,
      mode: group.mode,
    });
    setGroups((gs) => gs.filter((g) => g.id !== group.id));
    setSelection([...group.days]);
  };

  const setMode = (mode: HoursMode) =>
    setPending((p) => ({ ...p, mode: p.mode === mode ? 'hours' : mode }));

  const save = () => {
    if (!canSave) return;
    onSave(groups.map(({ id: _id, ...g }) => g));
  };

  const status = (() => {
    if (selection.length > 0) return t('hoursPicker.statusSetting', { days: formatDays(selection) });
    if (allDaysSet) return t('hoursPicker.statusAllSet');
    if (assigned.size > 0) return t('hoursPicker.statusRemaining');
    return t('hoursPicker.statusSelect');
  })();

  const sortedGroups = [...groups].sort((a, b) => Math.min(...a.days) - Math.min(...b.days));
  const overnight = pending.mode === 'hours' && pending.close < pending.open;

  return (
    <IonModal className="hours-picker" isOpen={isOpen} onDidDismiss={onCancel}>
      <IonContent className="hours-picker__content">
        <div className="hours-picker__header">
          <button
            type="button"
            className="hours-picker__icon-btn"
            aria-label={t('hoursPicker.cancelAria')}
            onClick={onCancel}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M6 6l12 12M18 6L6 18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            </svg>
          </button>
          <button
            type="button"
            className="hours-picker__icon-btn hours-picker__save"
            aria-label={t('hoursPicker.saveAria')}
            disabled={!canSave}
            onClick={save}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M20 6 9 17l-5-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        <div className="hours-picker__body">
          <div className="hours-picker__pills">
            {DAY_KEYS.map((dayKey, day) => {
              const selected = selection.includes(day);
              const isSet = !selected && assigned.has(day);
              return (
                <button
                  key={dayKey}
                  type="button"
                  className={`hours-picker__pill${selected ? ' hours-picker__pill--selected' : ''}${
                    isSet ? ' hours-picker__pill--set' : ''
                  }`}
                  aria-pressed={selected}
                  onClick={() => toggleDay(day)}
                >
                  {dayLabel(day)}
                  {isSet && <span className="hours-picker__pill-check">✓</span>}
                </button>
              );
            })}
          </div>

          <p className="hours-picker__status">{status}</p>

          {selection.length > 0 && (
            <div className="hours-picker__dialarea">
              {pending.mode === 'closed' ? (
                <div className="hours-picker__cards">
                  <div className="hours-picker__card hours-picker__card--banner">
                    <div className="hours-picker__card-label">{t('hoursPicker.closed')}</div>
                    <div className="hours-picker__card-time hours-picker__card-time--closed">
                      {t('hoursPicker.closedSub')}
                    </div>
                  </div>
                </div>
              ) : pending.mode === '24' ? (
                <div className="hours-picker__cards">
                  <div className="hours-picker__card hours-picker__card--banner">
                    <div className="hours-picker__card-label">{t('hoursPicker.open24')}</div>
                    <div className="hours-picker__card-time">{t('hoursPicker.open24Time')}</div>
                  </div>
                </div>
              ) : (
                <div className="hours-picker__cards">
                  <div className="hours-picker__card">
                    <div className="hours-picker__card-label">{t('hoursPicker.opens')}</div>
                    <div className="hours-picker__card-time">{formatTime(pending.open)}</div>
                    <div className="hours-picker__card-sub">&nbsp;</div>
                  </div>
                  <div className="hours-picker__card">
                    <div className="hours-picker__card-label">{t('hoursPicker.closes')}</div>
                    <div className="hours-picker__card-time">{formatTime(pending.close)}</div>
                    <div className="hours-picker__card-sub">{overnight ? t('hoursPicker.nextDay') : ' '}</div>
                  </div>
                </div>
              )}

              <HoursDial
                open={pending.open}
                close={pending.close}
                mode={pending.mode}
                onChange={({ open, close }) => setPending((p) => ({ ...p, open, close }))}
              />

              <div className="hours-picker__ghosts">
                <button
                  type="button"
                  className={`hours-picker__ghost${pending.mode === '24' ? ' hours-picker__ghost--on' : ''}`}
                  onClick={() => setMode('24')}
                >
                  {t('hoursPicker.open24Btn')}
                </button>
                <button
                  type="button"
                  className={`hours-picker__ghost hours-picker__ghost--closed${
                    pending.mode === 'closed' ? ' hours-picker__ghost--on' : ''
                  }`}
                  onClick={() => setMode('closed')}
                >
                  {t('hoursPicker.closedBtn')}
                </button>
              </div>

              <button type="button" className="hours-picker__set" onClick={commitSelection}>
                {t('hoursPicker.set', { days: formatDays(selection) })}
              </button>
            </div>
          )}

          {sortedGroups.length > 0 && (
            <div className="hours-picker__summary">
              {sortedGroups.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  className="hours-picker__srow"
                  onClick={() => editGroup(g)}
                >
                  <span className="hours-picker__srow-left">
                    <span className="hours-picker__srow-badge">✓</span>
                    <span className="hours-picker__srow-days">{formatDays(g.days)}</span>
                  </span>
                  <span className="hours-picker__srow-right">
                    <span className="hours-picker__srow-hours">{formatGroupHours(g)}</span>
                    <span className="hours-picker__srow-chev">›</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </IonContent>
    </IonModal>
  );
};

export default HoursPicker;
