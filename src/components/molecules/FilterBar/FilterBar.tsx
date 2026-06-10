import './FilterBar.scss';

export interface StoreFilter {
  key: string;
  label: string;
  icon: string;
}

/** Maps to the store feature flags on the API detail record. */
export const STORE_FILTERS: StoreFilter[] = [
  { key: 'preparedFood', label: 'HOT FOOD', icon: '🥪' },
  { key: 'lottery', label: 'LOTTERY', icon: '🎟' },
  { key: 'alcohol', label: 'BEER & WINE', icon: '🍺' },
  { key: 'tobacco', label: 'TOBACCO', icon: '🚬' },
];

interface FilterBarProps {
  /** Set of active filter keys. */
  active: Set<string>;
  onToggle: (key: string) => void;
}

const FilterBar: React.FC<FilterBarProps> = ({ active, onToggle }) => (
  <div className="filter-bar">
    {STORE_FILTERS.map((f) => {
      const isOn = active.has(f.key);
      return (
        <button
          key={f.key}
          type="button"
          className={`filter-bar__item${isOn ? ' filter-bar__item--active' : ''}`}
          aria-pressed={isOn}
          onClick={() => onToggle(f.key)}
        >
          <span className="filter-bar__icon">{f.icon}</span>
          <span className="filter-bar__label">{f.label}</span>
        </button>
      );
    })}
  </div>
);

export default FilterBar;
