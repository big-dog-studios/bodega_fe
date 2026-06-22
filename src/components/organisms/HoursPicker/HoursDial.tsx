import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { formatTime, MINUTES_IN_DAY, type HoursMode } from './hours';

/** 24h radial clock. Two handles set open/close; dragging the arc shifts the window. */

const R = 128; // arc radius in the 300×300 viewBox
const CENTER = 150;
const STEP = 15; // snap to quarter-hours
const MIN_WINDOW = 30; // keep at least 30 min between open and close

/** Minutes → degrees clockwise from midnight (top). */
const angle = (min: number) => (min / MINUTES_IN_DAY) * 360;

/** Polar (degrees, radius) → [x, y] in the viewBox, midnight at top. */
const point = (deg: number, radius: number): [number, number] => {
  const t = (deg * Math.PI) / 180;
  return [CENTER + radius * Math.sin(t), CENTER - radius * Math.cos(t)];
};

const arcPath = (open: number, close: number): string => {
  const [x0, y0] = point(angle(open), R);
  const [x1, y1] = point(angle(close), R);
  const span = (close - open + MINUTES_IN_DAY) % MINUTES_IN_DAY;
  const large = span > MINUTES_IN_DAY / 2 ? 1 : 0;
  return `M ${x0} ${y0} A ${R} ${R} 0 ${large} 1 ${x1} ${y1}`;
};

const fullRing = (): string => {
  const [ax, ay] = point(0, R);
  const [bx, by] = point(180, R);
  return `M ${ax} ${ay} A ${R} ${R} 0 1 1 ${bx} ${by} A ${R} ${R} 0 1 1 ${ax} ${ay}`;
};

// Static decorations — hour ticks (every hour, every 6th major) and key labels.
const TICKS = Array.from({ length: 24 }, (_, h) => {
  const deg = h * 15;
  const major = h % 6 === 0;
  const [x1, y1] = point(deg, major ? 86 : 90);
  const [x2, y2] = point(deg, 96);
  return { x1, y1, x2, y2, major };
});

const LABELS = (
  [
    ['12 AM', 0, true],
    ['2', 30, false],
    ['4', 60, false],
    ['6 AM', 90, true],
    ['8', 120, false],
    ['10', 150, false],
    ['12 PM', 180, true],
    ['2', 210, false],
    ['4', 240, false],
    ['6 PM', 270, true],
    ['8', 300, false],
    ['10', 330, false],
  ] as const
).map(([text, deg, major]) => {
  const [x, y] = point(deg, 72);
  return { text, x, y, major };
});

type DragKind = 'open' | 'close' | 'band';

interface HoursDialProps {
  open: number;
  close: number;
  mode: HoursMode;
  onChange: (next: { open: number; close: number }) => void;
}

const HoursDial: React.FC<HoursDialProps> = ({ open, close, mode, onChange }) => {
  const { t } = useTranslation();
  const wrapRef = useRef<HTMLDivElement>(null);
  // Live values for the window listeners (which are bound once on mount).
  const stateRef = useRef({ open, close, mode });
  stateRef.current = { open, close, mode };
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const drag = useRef<{ kind: DragKind; grab: number; io: number; ic: number } | null>(null);

  /** Pointer position → snapped minute on the dial. */
  const angleToMin = (clientX: number, clientY: number): number => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    const dx = clientX - (rect.left + rect.width / 2);
    const dy = clientY - (rect.top + rect.height / 2);
    const deg = ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360;
    const snapped = Math.round((deg / 360) * (MINUTES_IN_DAY / STEP)) * STEP;
    return ((snapped % MINUTES_IN_DAY) + MINUTES_IN_DAY) % MINUTES_IN_DAY;
  };

  const clampOpen = (m: number, c: number): number => {
    const span = (c - m + MINUTES_IN_DAY) % MINUTES_IN_DAY;
    if (span < MIN_WINDOW) return (c - MIN_WINDOW + MINUTES_IN_DAY) % MINUTES_IN_DAY;
    if (span > MINUTES_IN_DAY - MIN_WINDOW)
      return (c - (MINUTES_IN_DAY - MIN_WINDOW) + MINUTES_IN_DAY) % MINUTES_IN_DAY;
    return m;
  };
  const clampClose = (m: number, o: number): number => {
    const span = (m - o + MINUTES_IN_DAY) % MINUTES_IN_DAY;
    if (span < MIN_WINDOW) return (o + MIN_WINDOW) % MINUTES_IN_DAY;
    if (span > MINUTES_IN_DAY - MIN_WINDOW) return (o + (MINUTES_IN_DAY - MIN_WINDOW)) % MINUTES_IN_DAY;
    return m;
  };

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const { open: o, close: c } = stateRef.current;
      const m = angleToMin(e.clientX, e.clientY);
      if (d.kind === 'open') onChangeRef.current({ open: clampOpen(m, c), close: c });
      else if (d.kind === 'close') onChangeRef.current({ open: o, close: clampClose(m, o) });
      else {
        const delta = m - d.grab;
        onChangeRef.current({
          open: ((d.io + delta) % MINUTES_IN_DAY + MINUTES_IN_DAY) % MINUTES_IN_DAY,
          close: ((d.ic + delta) % MINUTES_IN_DAY + MINUTES_IN_DAY) % MINUTES_IN_DAY,
        });
      }
      e.preventDefault();
    };
    const up = () => {
      drag.current = null;
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, []);

  const startHandle = (kind: 'open' | 'close') => (e: React.PointerEvent) => {
    if (mode !== 'hours') return;
    drag.current = { kind, grab: 0, io: open, ic: close };
    e.preventDefault();
    e.stopPropagation();
  };
  const startBand = (e: React.PointerEvent) => {
    if (mode !== 'hours') return;
    drag.current = { kind: 'band', grab: angleToMin(e.clientX, e.clientY), io: open, ic: close };
    e.preventDefault();
  };

  // Keyboard nudges for accessibility (arrow keys move a handle by a step).
  const nudge = (kind: 'open' | 'close', delta: number) => {
    if (mode !== 'hours') return;
    if (kind === 'open') {
      const m = ((open + delta) % MINUTES_IN_DAY + MINUTES_IN_DAY) % MINUTES_IN_DAY;
      onChange({ open: clampOpen(m, close), close });
    } else {
      const m = ((close + delta) % MINUTES_IN_DAY + MINUTES_IN_DAY) % MINUTES_IN_DAY;
      onChange({ open, close: clampClose(m, open) });
    }
  };
  const onHandleKey = (kind: 'open' | 'close') => (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
      nudge(kind, STEP);
      e.preventDefault();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
      nudge(kind, -STEP);
      e.preventDefault();
    }
  };

  const [ox, oy] = point(angle(open), R);
  const [cx, cy] = point(angle(close), R);
  const showHandles = mode === 'hours';

  return (
    <div className="hours-dial" ref={wrapRef}>
      <svg className="hours-dial__svg" viewBox="0 0 300 300" aria-hidden="true">
        <circle cx={CENTER} cy={CENTER} r={R} className="hours-dial__track" />
        {mode !== 'closed' && (
          <path
            className="hours-dial__arc"
            d={mode === '24' ? fullRing() : arcPath(open, close)}
            onPointerDown={startBand}
          />
        )}
        <circle
          cx={CENTER}
          cy={CENTER}
          r={96}
          className="hours-dial__face"
          opacity={mode === 'closed' ? 0.4 : 1}
        />
        {TICKS.map((t, i) => (
          <line
            key={i}
            x1={t.x1}
            y1={t.y1}
            x2={t.x2}
            y2={t.y2}
            className={`hours-dial__tick${t.major ? ' hours-dial__tick--major' : ''}`}
          />
        ))}
        {LABELS.map((l, i) => (
          <text
            key={i}
            x={l.x}
            y={l.y}
            textAnchor="middle"
            dominantBaseline="central"
            className={`hours-dial__label${l.major ? ' hours-dial__label--major' : ''}`}
          >
            {l.text}
          </text>
        ))}
      </svg>

      {showHandles && (
        <>
          <button
            type="button"
            className="hours-dial__handle hours-dial__handle--open"
            style={{ left: `${(ox / 3).toFixed(3)}%`, top: `${(oy / 3).toFixed(3)}%` }}
            role="slider"
            aria-label={t('hoursPicker.openingTimeAria')}
            aria-valuetext={formatTime(open)}
            tabIndex={0}
            onPointerDown={startHandle('open')}
            onKeyDown={onHandleKey('open')}
          />
          <button
            type="button"
            className="hours-dial__handle hours-dial__handle--close"
            style={{ left: `${(cx / 3).toFixed(3)}%`, top: `${(cy / 3).toFixed(3)}%` }}
            role="slider"
            aria-label={t('hoursPicker.closingTimeAria')}
            aria-valuetext={formatTime(close)}
            tabIndex={0}
            onPointerDown={startHandle('close')}
            onKeyDown={onHandleKey('close')}
          />
        </>
      )}
    </div>
  );
};

export default HoursDial;
