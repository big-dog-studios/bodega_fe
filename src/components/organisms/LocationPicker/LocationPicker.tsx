import { useEffect, useState } from 'react';
import { IonContent, IonModal } from '@ionic/react';
import Map from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { reverseGeocode, type ReverseAddress } from '../../../lib/api';
import { MAP_STYLE, MIN_ZOOM, NYC_BOUNDS, NYC_CENTER } from '../../../lib/mapConfig';
import './LocationPicker.scss';

/** A point chosen on the map, with its reverse-geocoded address parts. */
export interface PickedLocation extends ReverseAddress {
  lat: number;
  lon: number;
}

const EMPTY_ADDRESS: ReverseAddress = { house: '', street: '', city: '', zip: '' };

interface LocationPickerProps {
  isOpen: boolean;
  /**
   * Where to center the map when opening — the store's point, or the user's
   * current location (passed in, since the map already has it). Falls back to NYC.
   */
  initial?: { lat: number; lon: number } | null;
  onCancel: () => void;
  onSelect: (loc: PickedLocation) => void;
}

/**
 * Full-screen map for picking a location. The map's center is the chosen point
 * (marked by a fixed pin); the user drags the map to position it. Each time the
 * map settles we reverse-geocode the center to a readable address, and confirm
 * hands back { lat, lon, address }.
 */
const LocationPicker: React.FC<LocationPickerProps> = ({ isOpen, initial, onCancel, onSelect }) => {
  const start = initial ? { longitude: initial.lon, latitude: initial.lat } : NYC_CENTER;
  const [center, setCenter] = useState(start);
  const [confirming, setConfirming] = useState(false);
  // Only mount the map once the modal is fully presented, so it initializes at
  // full size (no render-small-then-resize flash). Same as the main page, where
  // the map mounts into an already-laid-out container.
  const [presented, setPresented] = useState(false);

  // Recenter when the picker (re)opens for a new point.
  useEffect(() => {
    if (isOpen) setCenter(start);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initial?.lat, initial?.lon]);

  // Reverse-geocode only on confirm — one request, when the user commits.
  const confirm = async () => {
    setConfirming(true);
    let addr = EMPTY_ADDRESS;
    try {
      addr = (await reverseGeocode(center.latitude, center.longitude)) ?? EMPTY_ADDRESS;
    } catch {
      addr = EMPTY_ADDRESS;
    }
    onSelect({ lat: center.latitude, lon: center.longitude, ...addr });
  };

  return (
    <IonModal
      className="location-picker"
      isOpen={isOpen}
      onDidPresent={() => setPresented(true)}
      onDidDismiss={() => {
        setPresented(false);
        onCancel();
      }}
    >
      <IonContent className="location-picker__content" scrollY={false}>
        <div className="location-picker__header">
          <button
            type="button"
            className="location-picker__icon-btn"
            aria-label="Cancel"
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
            className="location-picker__icon-btn location-picker__confirm"
            aria-label="Use this location"
            disabled={confirming}
            onClick={confirm}
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

        <div className="location-picker__map">
          {presented && (
            <>
              <Map
                // Remount (re-apply initialViewState) when the opening point changes.
                key={`${start.longitude},${start.latitude}`}
                mapStyle={MAP_STYLE}
                initialViewState={{ ...start, zoom: 19 }}
                maxBounds={NYC_BOUNDS}
                minZoom={MIN_ZOOM}
                onMoveEnd={(e) => {
                  const { longitude, latitude } = e.viewState;
                  setCenter({ longitude, latitude });
                }}
                style={{ width: '100%', height: '100%' }}
              />
              {/* Fixed brand pin marking the map center (the chosen point). */}
              <div className="location-picker__pin" aria-hidden="true">
                <svg viewBox="0 0 28 40" className="location-picker__pin-svg">
                  <path
                    d="M14 0C6.3 0 0 6.3 0 14c0 9.7 12.1 24.4 13.1 25.5.5.6 1.4.6 1.9 0C15.9 38.4 28 23.7 28 14 28 6.3 21.7 0 14 0Z"
                    fill="var(--brand-blue)"
                    stroke="#ffffff"
                    strokeWidth="2"
                  />
                  <circle cx="14" cy="14" r="5.5" fill="var(--brand-orange)" />
                </svg>
              </div>
            </>
          )}
        </div>
      </IonContent>
    </IonModal>
  );
};

export default LocationPicker;
