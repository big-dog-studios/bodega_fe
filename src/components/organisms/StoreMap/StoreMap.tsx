import { useEffect, useState } from 'react';
import Map, { Marker, NavigationControl } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { IonSpinner } from '@ionic/react';
import { Geolocation } from '@capacitor/geolocation';
import './StoreMap.scss';

const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
// Fallback view (NYC) if geolocation is denied or unavailable.
const DEFAULT_VIEW = { longitude: -73.9857, latitude: 40.7484, zoom: 13 };

// Lock the map to NYC (five boroughs) — users can't pan or zoom out of the city.
const NYC_BOUNDS: [[number, number], [number, number]] = [
  [-74.2591, 40.4774], // SW
  [-73.7004, 40.9176], // NE
];
const MIN_ZOOM = 10;

/** True if a coordinate falls within the NYC bounding box. */
function inNyc(longitude: number, latitude: number): boolean {
  const [[west, south], [east, north]] = NYC_BOUNDS;
  return longitude >= west && longitude <= east && latitude >= south && latitude <= north;
}

interface ViewState {
  longitude: number;
  latitude: number;
  zoom: number;
}

interface LngLat {
  longitude: number;
  latitude: number;
}

const StoreMap: React.FC = () => {
  // Hold rendering until we've resolved a location, so the map's initial view
  // is the device location (not a default we then animate away from).
  const [view, setView] = useState<ViewState | null>(null);
  // The user's coords, only when we have a real in-NYC fix (drives the "you" dot).
  const [me, setMe] = useState<LngLat | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // requestPermissions() throws on web ("Not implemented on web") and only the
      // OS prompt matters on native — so it's best-effort and must NOT gate the
      // getCurrentPosition() call, which is what triggers the browser prompt on web.
      try {
        await Geolocation.requestPermissions();
      } catch {
        // web / unsupported — ignore and let getCurrentPosition do the asking
      }
      try {
        const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true });
        const { longitude, latitude } = pos.coords;
        // Only use the device location if it's inside NYC; otherwise drop to default.
        if (!cancelled && inNyc(longitude, latitude)) {
          // Street-level: ~a few walkable blocks around the user.
          setView({ longitude, latitude, zoom: 16 });
          setMe({ longitude, latitude });
          return;
        }
      } catch {
        // denied or unavailable — fall back to the default view below
      }
      if (!cancelled) setView(DEFAULT_VIEW);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!view) {
    return (
      <div className="store-map store-map--loading">
        <IonSpinner name="crescent" />
      </div>
    );
  }

  return (
    <div className="store-map">
      <Map mapStyle={MAP_STYLE} initialViewState={view} maxBounds={NYC_BOUNDS} minZoom={MIN_ZOOM}>
        <NavigationControl position="top-right" showCompass={false} />
        {me && (
          <Marker longitude={me.longitude} latitude={me.latitude}>
            <div className="user-dot" aria-label="Your location" />
          </Marker>
        )}
      </Map>
    </div>
  );
};

export default StoreMap;
