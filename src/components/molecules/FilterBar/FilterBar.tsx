import type { StoreFilters } from '../../../lib/api';
import './FilterBar.scss';

export interface StoreFilter {
  key: string;
  label: string;
  icon: string;
  /** The getStores() query param this filter sets. */
  param: keyof StoreFilters;
}

export const STORE_FILTERS: StoreFilter[] = [
  { key: 'preparedFood', label: 'HOT FOOD', icon: '🥪', param: 'has_prepared_food' },
  { key: 'lottery', label: 'LOTTERY', icon: '🎟', param: 'has_lottery' },
  { key: 'alcohol', label: 'BEER & WINE', icon: '🍺', param: 'has_alcohol' },
  { key: 'tobacco', label: 'TOBACCO', icon: '🚬', param: 'has_tobacco' },
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
