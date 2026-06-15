import { IonContent, IonMenu } from '@ionic/react';
import { useStores } from '../../../context/StoresContext';
import { useHotbar } from '../../../context/HotbarContext';
import { FILTERS } from '../../../lib/filters';
import { NEW_BODEGA_TRIGGER_ID } from '../NewBodegaForm';
import './AppMenu.scss';

/** menuId the header's IonMenuButton targets; contentId is the routed outlet. */
export const APP_MENU_ID = 'app-menu';

/**
 * Right-side slide-in drawer behind the header hamburger. Rendered once at the
 * app root as a sibling of the router outlet (see App.tsx); opened by the
 * IonMenuButton in AppHeader.
 */
const AppMenu: React.FC = () => {
  const { activeFilters, toggleFilter } = useStores();
  const { hotbarKeys } = useHotbar();

  // The drawer shows every filter that isn't already in the bottom bar.
  const menuFilters = FILTERS.filter((f) => !hotbarKeys.includes(f.key));

  return (
    <IonMenu
      className="app-menu"
      menuId={APP_MENU_ID}
      contentId="main-content"
      side="end"
      type="reveal"
      swipeGesture={false}
      onIonWillOpen={() => document.body.classList.add('app-menu-open')}
      onIonDidClose={() => document.body.classList.remove('app-menu-open')}
    >
      <IonContent className="app-menu__content">
        <p className="app-menu__label">MORE FILTERS</p>
        <div className="app-menu__filters">
          {menuFilters.map((f) => {
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

        <button type="button" id={NEW_BODEGA_TRIGGER_ID} className="app-menu__add" slot="fixed">
          <span className="app-menu__add-plus">+</span> Add bodega
        </button>
      </IonContent>
    </IonMenu>
  );
};

export default AppMenu;
