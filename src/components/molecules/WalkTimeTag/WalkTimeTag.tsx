import { useTranslation } from 'react-i18next';
import { useUserLocation } from '../../../context/LocationContext';
import { distanceMiles, walkMinutes } from '../../../lib/geo';
import './WalkTimeTag.scss';

interface WalkTimeTagProps {
  /** The selected store's coordinates. */
  lat: number;
  lon: number;
}

// Only show the tag when the store is within an easy walk.
const MAX_WALK_MILES = 1;

/**
 * "🚶 N min walk" tag for the detail sheet, shown only when the store is within
 * a mile of the user. Isolated in its own component on purpose: it subscribes to
 * the live location, which ticks several times a second, so keeping it here means
 * only this tag re-renders on each fix — not the whole detail sheet.
 */
const WalkTimeTag: React.FC<WalkTimeTagProps> = ({ lat, lon }) => {
  const { t } = useTranslation();
  const me = useUserLocation();
  if (!me) return null;

  const miles = distanceMiles(me, { lat, lon });
  if (miles > MAX_WALK_MILES) return null;

  return <p className="walk-time-tag">{t('detail.walkTime', { count: walkMinutes(miles) })}</p>;
};

export default WalkTimeTag;
