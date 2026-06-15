import { useEffect, useRef, useState } from 'react';
import {
  IonContent,
  IonItem,
  IonLabel,
  IonList,
  IonPopover,
  createGesture,
  type GestureDetail,
} from '@ionic/react';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { useHotbar } from '../../../context/HotbarContext';
import { FILTERS, getFilter, type StoreFilter } from '../../../lib/filters';
import './FilterBar.scss';

/** Hold this long for a press to count as a long-press (vs a tap). */
const LONG_PRESS_MS = 450;
/** Cancel the long-press if the finger drifts more than this. */
const MOVE_TOLERANCE = 10;

interface FilterChipProps {
  filter: StoreFilter;
  isActive: boolean;
  onToggle: () => void;
  onLongPress: (chipEl: HTMLElement) => void;
}

/** A single bar chip — a gesture splits a quick tap (toggle) from a long-press. */
const FilterChip: React.FC<FilterChipProps> = ({ filter, isActive, onToggle, onLongPress }) => {
  const ref = useRef<HTMLButtonElement>(null);
  // Keep the latest callbacks without re-creating the gesture each render.
  const toggleRef = useRef(onToggle);
  const longPressRef = useRef(onLongPress);
  toggleRef.current = onToggle;
  longPressRef.current = onLongPress;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let longPressed = false;

    const gesture = createGesture({
      el,
      gestureName: 'filter-chip-press',
      threshold: 0,
      onStart: () => {
        longPressed = false;
        timer = setTimeout(() => {
          longPressed = true;
          void Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
          longPressRef.current(el);
        }, LONG_PRESS_MS);
      },
      onMove: (detail: GestureDetail) => {
        if (Math.abs(detail.deltaX) > MOVE_TOLERANCE || Math.abs(detail.deltaY) > MOVE_TOLERANCE) {
          clearTimeout(timer);
        }
      },
      onEnd: () => {
        clearTimeout(timer);
        if (!longPressed) toggleRef.current();
      },
    });
    gesture.enable();
    return () => gesture.destroy();
  }, []);

  return (
    <button
      ref={ref}
      type="button"
      className={`filter-bar__item${isActive ? ' filter-bar__item--active' : ''}`}
      aria-pressed={isActive}
    >
      <span className="filter-bar__icon">{filter.icon}</span>
      <span className="filter-bar__label">{filter.label}</span>
    </button>
  );
};

interface FilterBarProps {
  /** Set of active filter keys. */
  active: Set<string>;
  onToggle: (key: string) => void;
}

/**
 * Bottom bar — renders the user's hotbar filters. Tap toggles; long-press opens
 * a popover of the remaining filters, and picking one swaps it into that slot.
 */
const FilterBar: React.FC<FilterBarProps> = ({ active, onToggle }) => {
  const { hotbarKeys, setHotbar } = useHotbar();
  const items = hotbarKeys.map(getFilter).filter((f): f is StoreFilter => f !== undefined);
  // Filters not already in the bar — the choices offered on long-press.
  const available = FILTERS.filter((f) => !hotbarKeys.includes(f.key));
  const barRef = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<{ key: string; event: Event } | null>(null);

  // Replace the long-pressed slot's filter with the chosen one (same position).
  const swap = (slotKey: string, newKey: string) =>
    setHotbar(hotbarKeys.map((k) => (k === slotKey ? newKey : k)));

  // Open the swap menu: horizontally centered on the long-pressed chip, but
  // anchored to the top of the bar so it always sits just above it.
  const openMenu = (slotKey: string, chipEl: HTMLElement) => {
    const chip = chipEl.getBoundingClientRect();
    const bar = barRef.current?.getBoundingClientRect();
    const event = new MouseEvent('click', {
      clientX: chip.left + chip.width / 2,
      clientY: bar ? bar.top : chip.top,
    });
    setMenu({ key: slotKey, event });
  };

  return (
    <div className="filter-bar" ref={barRef}>
      {items.map((f) => (
        <FilterChip
          key={f.key}
          filter={f}
          isActive={active.has(f.key)}
          onToggle={() => onToggle(f.key)}
          onLongPress={(chipEl) => openMenu(f.key, chipEl)}
        />
      ))}

      <IonPopover
        className="filter-bar__popover"
        isOpen={menu !== null}
        event={menu?.event}
        reference="event"
        onDidDismiss={() => setMenu(null)}
        dismissOnSelect
        side="top"
        alignment="center"
      >
        <IonContent>
          <IonList lines="full">
            {available.map((opt) => (
              <IonItem
                key={opt.key}
                button
                detail={false}
                onClick={() => {
                  if (menu) swap(menu.key, opt.key);
                  setMenu(null);
                }}
              >
                <span className="filter-bar__popover-icon" slot="start">
                  {opt.icon}
                </span>
                <IonLabel>{opt.label}</IonLabel>
              </IonItem>
            ))}
          </IonList>
        </IonContent>
      </IonPopover>
    </div>
  );
};

export default FilterBar;
