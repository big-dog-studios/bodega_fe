import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Map, {
  Layer,
  Marker,
  NavigationControl,
  Source,
  type MapLayerMouseEvent,
  type MapRef,
} from 'react-map-gl/maplibre';
import type { GeoJSONSource } from 'maplibre-gl';
import type { FeatureCollection, Point } from 'geojson';
import 'maplibre-gl/dist/maplibre-gl.css';
import { IonSpinner } from '@ionic/react';
import { Geolocation } from '@capacitor/geolocation';
import { useStores } from '../../../context/StoresContext';
import { useFavorites } from '../../../context/FavoritesContext';
import type { Bbox, StoreFilters } from '../../../lib/api';
import {
  clusterLayer,
  ensureTileImages,
  INTERACTIVE_LAYERS,
  makeUnclusteredLayer,
  SOURCE_ID,
} from './storeLayers';
import FilterFab from '../../molecules/FilterFab';
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

interface StoreMapProps {
  /** Active feature filters; passed through to getStores(). */
  filters?: StoreFilters;
}

const StoreMap: React.FC<StoreMapProps> = ({ filters }) => {
  // Hold rendering until we've resolved a location, so the map's initial view
  // is the device location (not a default we then animate away from).
  const [view, setView] = useState<ViewState | null>(null);
  // The user's coords, only when we have a real in-NYC fix (drives the "you" dot).
  const [me, setMe] = useState<LngLat | null>(null);
  // Show the re-center button only once the map has moved away from its start.
  const [moved, setMoved] = useState(false);
  // When on, only favorited stores are rendered (client-side filter, no fetch).
  const [favOnly, setFavOnly] = useState(false);
  const mapRef = useRef<MapRef>(null);
  const { loadStores, pins, selectStore, selectedId, activeFilters, toggleFilter } = useStores();
  const { isFavorite, favorites } = useFavorites();

  // Compare the live viewport to the starting view; flag if it's drifted enough
  // to be worth offering a re-center (tiny deltas = no real move).
  const handleMove = useCallback(() => {
    const map = mapRef.current;
    if (!map || !view) return;
    const c = map.getCenter();
    const drifted =
      Math.abs(map.getZoom() - view.zoom) > 0.05 ||
      Math.abs(c.lng - view.longitude) > 0.0005 ||
      Math.abs(c.lat - view.latitude) > 0.0005;
    setMoved(drifted);
  }, [view]);

  // Animate to the user's current location (the live "you" dot); fall back to
  // the starting view if we don't have a fix yet.
  const recenter = useCallback(() => {
    const target = me ?? (view && { longitude: view.longitude, latitude: view.latitude });
    if (!target) return;
    mapRef.current?.flyTo({
      center: [target.longitude, target.latitude],
      zoom: view?.zoom ?? 16,
      duration: 800,
    });
  }, [me, view]);

  // Move/zoom the map so every favorite is in view.
  const fitToFavorites = useCallback(() => {
    const pts = favorites.filter((f) => Number.isFinite(f.lat) && Number.isFinite(f.lon));
    if (pts.length === 0) return;
    if (pts.length === 1) {
      mapRef.current?.flyTo({ center: [pts[0].lon, pts[0].lat], zoom: 15, duration: 800 });
      return;
    }
    const lons = pts.map((f) => f.lon);
    const lats = pts.map((f) => f.lat);
    mapRef.current?.fitBounds(
      [
        [Math.min(...lons), Math.min(...lats)],
        [Math.max(...lons), Math.max(...lats)],
      ],
      { padding: 80, maxZoom: 16, duration: 800 },
    );
  }, [favorites]);

  // If the last favorite is removed while filtering, drop back to all stores.
  useEffect(() => {
    if (favOnly && favorites.length === 0) setFavOnly(false);
  }, [favOnly, favorites.length]);

  // Toggle favorites-only mode; on enable, frame all favorites.
  const toggleFavOnly = useCallback(() => {
    const next = !favOnly;
    setFavOnly(next);
    if (next) fitToFavorites();
  }, [favOnly, fitToFavorites]);

  // Pins as a GeoJSON FeatureCollection — the source MapLibre clusters for us.
  // In favorites-only mode, drop everything that isn't favorited.
  const geojson = useMemo<FeatureCollection<Point>>(
    () => ({
      type: 'FeatureCollection',
      features: pins
        .filter((p) => !favOnly || isFavorite(p.license_number))
        .map((p) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
          properties: { license_number: p.license_number, dba: p.dba },
        })),
    }),
    [pins, favOnly, isFavorite],
  );

  // Single (unclustered) pin — the brand "B" tile, swapped to red when selected.
  const unclusteredLayer = useMemo(() => makeUnclusteredLayer(selectedId), [selectedId]);

  // Click a cluster → zoom to where it splits; click a pin → open its sheet.
  const onMapClick = useCallback(
    (e: MapLayerMouseEvent) => {
      const feature = e.features?.[0];
      if (!feature) return;
      if (feature.properties?.cluster) {
        const source = mapRef.current?.getSource(SOURCE_ID) as GeoJSONSource | undefined;
        if (!source) return;
        const clusterId = feature.properties.cluster_id as number;
        void source.getClusterExpansionZoom(clusterId).then((zoom: number) => {
          const [longitude, latitude] = (feature.geometry as Point).coordinates;
          mapRef.current?.easeTo({ center: [longitude, latitude], zoom, duration: 500 });
        });
      } else {
        selectStore(feature.properties?.license_number as string);
      }
    },
    [selectStore],
  );

  // Pointer cursor while hovering a clickable cluster/pin.
  const [cursor, setCursor] = useState('');

  // Read the current viewport bbox and fetch pins for it (saved to context).
  const loadStoresForViewport = useCallback(() => {
    const b = mapRef.current?.getBounds();
    if (!b) return;
    const bbox: Bbox = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()];
    loadStores(bbox, filters);
  }, [loadStores, filters]);

  // Re-fetch the current viewport whenever the filters change.
  useEffect(() => {
    loadStoresForViewport();
  }, [loadStoresForViewport]);

  useEffect(() => {
    let cancelled = false;
    let watchId: string | null = null;

    (async () => {
      // requestPermissions() throws on web ("Not implemented on web") and only the
      // OS prompt matters on native — so it's best-effort and must NOT gate the
      // watchPosition() call, which is what triggers the browser prompt on web.
      try {
        await Geolocation.requestPermissions();
      } catch {
        // web / unsupported — ignore and let watchPosition do the asking
      }

      try {
        const id = await Geolocation.watchPosition({ enableHighAccuracy: true }, (pos, err) => {
          if (cancelled) return;
          if (err || !pos) {
            // denied or unavailable — make sure the map still renders
            setView((v) => v ?? DEFAULT_VIEW);
            return;
          }
          const { longitude, latitude } = pos.coords;
          if (inNyc(longitude, latitude)) {
            // Live dot follows every fix; center only on the FIRST one (zoom 16,
            // ~a few walkable blocks) so the map doesn't yank around as you move.
            setMe({ longitude, latitude });
            setView((v) => v ?? { longitude, latitude, zoom: 16 });
          } else {
            // Outside NYC — hide the dot, fall back to the default view.
            setMe(null);
            setView((v) => v ?? DEFAULT_VIEW);
          }
        });
        if (cancelled) {
          Geolocation.clearWatch({ id });
          return;
        }
        watchId = id;
      } catch {
        if (!cancelled) setView((v) => v ?? DEFAULT_VIEW);
      }
    })();

    return () => {
      cancelled = true;
      if (watchId) Geolocation.clearWatch({ id: watchId });
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
      <Map
        ref={mapRef}
        mapStyle={MAP_STYLE}
        initialViewState={view}
        maxBounds={NYC_BOUNDS}
        minZoom={MIN_ZOOM}
        onLoad={(e) => {
          // styleimagemissing is the race-proof fallback; also add up front.
          e.target.on('styleimagemissing', () => ensureTileImages(e.target));
          ensureTileImages(e.target);
          loadStoresForViewport();
        }}
        onMove={handleMove}
        onMoveEnd={loadStoresForViewport}
        interactiveLayerIds={INTERACTIVE_LAYERS}
        cursor={cursor}
        onClick={onMapClick}
        onMouseEnter={() => setCursor('pointer')}
        onMouseLeave={() => setCursor('')}
      >
        <NavigationControl position="top-right" showCompass={false} />
        <Source
          id={SOURCE_ID}
          type="geojson"
          data={geojson}
          cluster
          clusterRadius={50}
          clusterMaxZoom={14}
        >
          <Layer {...clusterLayer} />
          <Layer {...unclusteredLayer} />
        </Source>
        {me && (
          <Marker longitude={me.longitude} latitude={me.latitude}>
            <div className="user-dot" aria-label="Your location" />
          </Marker>
        )}
      </Map>
      {/* Right-side control column, anchored to the bottom. Order top→bottom:
          recenter, favorites, filter FAB. Conditional buttons just drop out and
          the column collapses (gap-driven), so the rest slides down on its own. */}
      <div className="map-controls">
        {moved && (
          <button
            type="button"
            className="recenter-btn"
            aria-label="Re-center map"
            onClick={recenter}
          >
            <svg viewBox="0 0 24 24" width="23" height="23" aria-hidden="true">
              <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
              <circle cx="12" cy="12" r="3" fill="currentColor" />
            </svg>
          </button>
        )}
        {favorites.length > 0 && (
          <button
            type="button"
            className={`fav-toggle${favOnly ? ' fav-toggle--on' : ''}`}
            aria-label="Show favorites only"
            aria-pressed={favOnly}
            onClick={toggleFavOnly}
          >
            {favOnly ? '★' : '☆'}
          </button>
        )}
        <FilterFab active={activeFilters} onToggle={toggleFilter} />
      </div>
    </div>
  );
};

export default StoreMap;
