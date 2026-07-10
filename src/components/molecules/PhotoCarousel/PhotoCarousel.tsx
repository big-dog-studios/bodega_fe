import { useCallback, useEffect, useRef, useState } from 'react';
import { Network } from '@capacitor/network';
import { storefrontPhotoUrl } from '../../../lib/api';
import './PhotoCarousel.scss';

interface PhotoCarouselProps {
  /** Storefront photo paths from `Store.storefront_photos` (relative, not URLs). */
  paths: string[];
}

/**
 * Swipeable storefront photos, styled after the "peek card" pattern: each photo
 * is an inset rounded card that snaps to center, with the neighbours peeking in
 * on both sides and a row of page dots below. Native CSS scroll-snap (no Swiper
 * dependency) keeps it light in the webview; images lazy-load (`loading="lazy"`
 * + `decoding="async"`) so only near slides fetch. Individual images that fail
 * (dead path, 404) drop out silently; the strip renders nothing when the list
 * is empty or every image fails, so photo-less stores are unaffected.
 */
const PhotoCarousel: React.FC<PhotoCarouselProps> = ({ paths }) => {
  // Track failures by slide index so repeated paths (e.g. test dupes) are distinct.
  const [failed, setFailed] = useState<Set<number>>(new Set());
  const [active, setActive] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const raf = useRef(0);

  // Photos are fetched on view, never cached — so offline there's nothing to
  // show. Track connectivity and skip the carousel entirely when offline (rather
  // than render broken/empty cards). Re-renders when the device reconnects.
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    let handle: { remove: () => Promise<void> } | undefined;
    void Network.getStatus().then((s) => setOnline(s.connected));
    void Network.addListener('networkStatusChange', (s) => setOnline(s.connected)).then((h) => {
      handle = h;
    });
    return () => void handle?.remove();
  }, []);

  const shown = paths.map((path, i) => ({ path, i })).filter(({ i }) => !failed.has(i));

  // Active dot = the card whose centre is nearest the viewport centre. rAF-throttled
  // so the scroll handler doesn't thrash on every frame of a swipe.
  const onScroll = useCallback(() => {
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      const el = trackRef.current;
      if (!el) return;
      const centre = el.scrollLeft + el.clientWidth / 2;
      let best = 0;
      let bestDist = Infinity;
      Array.from(el.children).forEach((c, i) => {
        const child = c as HTMLElement;
        const dist = Math.abs(child.offsetLeft + child.offsetWidth / 2 - centre);
        if (dist < bestDist) {
          bestDist = dist;
          best = i;
        }
      });
      setActive(best);
    });
  }, []);

  const goTo = (i: number) => {
    const child = trackRef.current?.children[i] as HTMLElement | undefined;
    child?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  };

  // Offline: nothing to show (photos aren't cached), and no images means no empty cards.
  if (!online || shown.length === 0) return null;

  // A single photo has no neighbour to peek at (and no dots), so drop the
  // snap/peek/dots treatment but keep the card styling — one wider, centred card.
  if (shown.length === 1) {
    const { path, i } = shown[0];
    return (
      <div className="photo-carousel photo-carousel--solo">
        <div className="photo-carousel__card">
          <img
            className="photo-carousel__img"
            src={storefrontPhotoUrl(path)}
            alt=""
            loading="eager"
            decoding="async"
            draggable={false}
            onError={() => setFailed((prev) => new Set(prev).add(i))}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="photo-carousel">
      <div className="photo-carousel__track" ref={trackRef} onScroll={onScroll}>
        {shown.map(({ path, i }, pos) => (
          <div className="photo-carousel__card" key={i}>
            <img
              className="photo-carousel__img"
              src={storefrontPhotoUrl(path)}
              alt=""
              loading={pos <= 1 ? 'eager' : 'lazy'}
              decoding="async"
              draggable={false}
              onError={() => setFailed((prev) => new Set(prev).add(i))}
            />
          </div>
        ))}
      </div>

      {shown.length > 1 && (
        <div className="photo-carousel__dots" role="tablist">
          {shown.map(({ i }, pos) => (
            <button
              key={i}
              type="button"
              className={`photo-carousel__dot${pos === active ? ' photo-carousel__dot--active' : ''}`}
              aria-label={`Photo ${pos + 1}`}
              aria-selected={pos === active}
              onClick={() => goTo(pos)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default PhotoCarousel;
