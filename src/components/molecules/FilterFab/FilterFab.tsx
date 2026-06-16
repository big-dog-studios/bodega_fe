import { useEffect, useState } from 'react';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Preferences } from '@capacitor/preferences';
import { FILTERS } from '../../../lib/filters';
import './FilterFab.scss';

/** Preferences flag marking that the one-time filter intro has played. */
const INTRO_SEEN_KEY = 'filterFabIntroSeen';
/** Beat before the intro opens (lets the map settle), and how long it dwells open. */
const INTRO_DELAY_MS = 600;
const INTRO_DWELL_MS = 1900;

interface FilterFabProps {
  /** Set of active filter keys. */
  active: Set<string>;
  onToggle: (key: string) => void;
}

/**
 * Floating action button at the bottom of the map's right-side control column.
 * Tapping the trigger expands a labeled, toggleable list of every filter (rising
 * upward, staggered). Filters are multi-select, so the list stays open across
 * taps; a scrim closes it.
 */
const FilterFab: React.FC<FilterFabProps> = ({ active, onToggle }) => {
  const [open, setOpen] = useState(false);
  const activeCount = active.size;

  // First launch only: animate the list open then closed so the user discovers
  // the filters. Persisted via Preferences so it plays exactly once.
  useEffect(() => {
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    Preferences.get({ key: INTRO_SEEN_KEY })
      .then(({ value }) => {
        if (cancelled || value) return;
        void Preferences.set({ key: INTRO_SEEN_KEY, value: '1' });
        timers.push(setTimeout(() => setOpen(true), INTRO_DELAY_MS));
        timers.push(setTimeout(() => setOpen(false), INTRO_DELAY_MS + INTRO_DWELL_MS));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, []);

  const toggleOpen = () => {
    setOpen((o) => !o);
    void Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
  };

  const handleToggle = (key: string) => {
    onToggle(key);
    void Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
  };

  return (
    <div className={`filter-fab${open ? ' filter-fab--open' : ''}`}>
      <button
        type="button"
        className="filter-fab__scrim"
        aria-label="Close filters"
        tabIndex={open ? 0 : -1}
        onClick={() => setOpen(false)}
      />

      <div className="filter-fab__list" role="menu" aria-hidden={!open}>
        {FILTERS.map((f, i) => {
          const isOn = active.has(f.key);
          return (
            <button
              key={f.key}
              type="button"
              role="menuitemcheckbox"
              aria-checked={isOn}
              tabIndex={open ? 0 : -1}
              // Stagger the rise: items nearest the trigger lead, top ones trail.
              style={{ transitionDelay: open ? `${(FILTERS.length - 1 - i) * 25}ms` : '0ms' }}
              className={`filter-fab__item${isOn ? ' filter-fab__item--active' : ''}`}
              onClick={() => handleToggle(f.key)}
            >
              <span className="filter-fab__item-label">{f.label}</span>
              <span className="filter-fab__item-icon">{f.icon}</span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        className="filter-fab__trigger"
        aria-label="Filters"
        aria-expanded={open}
        onClick={toggleOpen}
      >
        {open ? (
          <svg className="filter-fab__glyph" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M6 6l12 12M18 6L6 18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
        ) : (
          <svg className="filter-fab__glyph" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M3 5h18l-7 8v6l-4 2v-8L3 5z"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
            />
          </svg>
        )}
        {!open && activeCount > 0 && <span className="filter-fab__badge">{activeCount}</span>}
      </button>
    </div>
  );
};

export default FilterFab;
