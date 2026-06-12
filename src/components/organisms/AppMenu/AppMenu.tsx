import { IonContent, IonMenu } from '@ionic/react';
import { useStores } from '../../../context/StoresContext';
import type { StoreFilter } from '../../molecules/FilterBar';
import './AppMenu.scss';

/** menuId the header's IonMenuButton targets; contentId is the routed outlet. */
export const APP_MENU_ID = 'app-menu';

/** Extra filters shown in the drawer — same shape as the filter bar's. */
export const MENU_FILTERS: StoreFilter[] = [
  { key: 'cat', label: 'CAT', icon: '🐈', param: 'has_cat' },
  { key: 'atm', label: 'ATM', icon: '🏧', param: 'has_atm' },
  { key: 'delivery', label: 'DELIVERY', icon: '🛵', param: 'delivery' },
  { key: 'takeout', label: 'TAKEOUT', icon: '🥡', param: 'takeout' },
  { key: 'snap', label: 'SNAP/EBT', icon: '🛒', param: 'has_snap' },
  { key: 'quickDraw', label: 'QUICK DRAW', icon: '🎰', param: 'has_quick_draw' },
];

/**
 * Right-side slide-in drawer behind the header hamburger. Rendered once at the
 * app root as a sibling of the router outlet (see App.tsx); opened by the
 * IonMenuButton in AppHeader.
 */
const AppMenu: React.FC = () => {
  const { activeFilters, toggleFilter } = useStores();

  return (
    <IonMenu
      className="app-menu"
      menuId={APP_MENU_ID}
      contentId="main-content"
      side="end"
      type="overlay"
    >
      <IonContent className="app-menu__content">
        <p className="app-menu__label">MORE FILTERS</p>
        <div className="app-menu__filters">
          {MENU_FILTERS.map((f) => {
            const isOn = activeFilters.has(f.key);
            return (
              <button
                key={f.key}
                type="button"
                className={`app-menu__filter${isOn ? ' app-menu__filter--active' : ''}`}
                aria-pressed={isOn}
                onClick={() => toggleFilter(f.key)}
              >
                <span className="app-menu__filter-icon">{f.icon}</span>
                <span className="app-menu__filter-label">{f.label}</span>
              </button>
            );
          })}
        </div>
      </IonContent>
    </IonMenu>
  );
};

export default AppMenu;
