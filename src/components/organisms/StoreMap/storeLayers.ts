// Map rendering bits for StoreMap: the brand pin/cluster tile images and the
// MapLibre layer specs that draw them. Pure (no React) — the component just
// wires these onto the map and reacts to selection.
import type { SymbolLayerSpecification } from 'react-map-gl/maplibre';
import type { ExpressionSpecification, Map as MaplibreMap } from 'maplibre-gl';

// Brand palette (must be literal colors — MapLibre paint can't read CSS vars).
const BRAND_BLUE = '#251ad1';
const BRAND_ORANGE = '#fea703';
const BRAND_RED = '#e61800';

/** GeoJSON source id the pins/clusters are read from. */
export const SOURCE_ID = 'stores';
/** Layers clicks/hover should hit. */
export const INTERACTIVE_LAYERS = ['clusters', 'unclustered'];

// Registered map image ids for the brand tiles.
const IMG_PIN = 'bodega-pin';
const IMG_PIN_SELECTED = 'bodega-pin-selected';
const IMG_CLUSTER = 'bodega-cluster'; // 9-slice tile that stretches around the count

// Draw the square brand tile (blue/red fill, orange ring, optional baked label)
// to a canvas and return it as an addImage()-ready spec. `stretch` makes a
// 9-slice tile whose middle can stretch to fit cluster-count text.
function makeTile(opts: {
  bg: string;
  label?: string;
  stretch?: boolean;
}): { data: ImageData; options: Parameters<MaplibreMap['addImage']>[2] } {
  const scale = 3; // render at 3x for crisp retina
  const size = 30;
  const border = 3;
  const radius = 6;
  const pad = 5; // room for the drop shadow
  const W = (size + pad * 2) * scale;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = W;
  const ctx = canvas.getContext('2d')!;

  const x = pad * scale;
  const y = pad * scale;
  const s = size * scale;
  const b = border * scale;
  const r = radius * scale;
  // Rounded-rect tile, inset by half the stroke so the ring isn't clipped.
  const i = b / 2;
  ctx.beginPath();
  ctx.roundRect(x + i, y + i, s - b, s - b, r);
  ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
  ctx.shadowBlur = 3 * scale;
  ctx.shadowOffsetY = 2 * scale;
  ctx.fillStyle = opts.bg;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = b;
  ctx.strokeStyle = BRAND_ORANGE;
  ctx.stroke();

  if (opts.label) {
    ctx.fillStyle = BRAND_ORANGE;
    ctx.font = `800 ${17 * scale}px 'Barlow Condensed', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(opts.label, x + s / 2, y + s / 2 + scale);
  }

  const data = ctx.getImageData(0, 0, W, W);
  const options: Parameters<MaplibreMap['addImage']>[2] = { pixelRatio: scale };
  if (opts.stretch) {
    // Stretch/content zones (raw px) keep the rounded corners fixed while the
    // middle grows to wrap the number; content box is where the text sits.
    const lo = x + r;
    const hi = x + s - r;
    options.stretchX = [[lo, hi]];
    options.stretchY = [[lo, hi]];
    options.content = [x + b, y + b, x + s - b, y + s - b];
  }
  return { data, options };
}

// Register the three brand tiles on a map (idempotent). Run on load and via
// styleimagemissing so layers never reference an image that isn't there yet.
export function ensureTileImages(map: MaplibreMap): void {
  const defs: Record<string, { bg: string; label?: string; stretch?: boolean }> = {
    [IMG_PIN]: { bg: BRAND_BLUE, label: 'B' },
    [IMG_PIN_SELECTED]: { bg: BRAND_RED, label: 'B' },
    [IMG_CLUSTER]: { bg: BRAND_BLUE, stretch: true },
  };
  for (const [id, opt] of Object.entries(defs)) {
    if (map.hasImage(id)) continue;
    const { data, options } = makeTile(opt);
    map.addImage(id, data, options);
  }
}

// Cluster tile — the brand square stretched to fit the count, number in orange.
export const clusterLayer: SymbolLayerSpecification = {
  id: 'clusters',
  type: 'symbol',
  source: SOURCE_ID,
  filter: ['has', 'point_count'],
  layout: {
    'icon-image': IMG_CLUSTER,
    'icon-text-fit': 'both',
    'icon-text-fit-padding': [4, 6, 4, 6],
    'icon-allow-overlap': true,
    'text-allow-overlap': true,
    'text-field': ['get', 'point_count_abbreviated'],
    'text-font': ['Noto Sans Bold'],
    'text-size': 15,
  },
  paint: { 'text-color': BRAND_ORANGE },
};

/**
 * Single (unclustered) pin layer — the brand "B" tile, swapped to the red tile
 * and popped 1.25× when its store is selected. Built per selection so the
 * data expression reflects the current `selectedId`.
 */
export function makeUnclusteredLayer(selectedId: string | null): SymbolLayerSpecification {
  const isSelected: ExpressionSpecification = ['==', ['get', 'license_number'], selectedId ?? ''];
  return {
    id: 'unclustered',
    type: 'symbol',
    source: SOURCE_ID,
    filter: ['!', ['has', 'point_count']],
    layout: {
      'icon-image': ['case', isSelected, IMG_PIN_SELECTED, IMG_PIN],
      'icon-allow-overlap': true,
      // Selected pin pops slightly larger, matching the old marker.
      'icon-size': ['case', isSelected, 1.25, 1],
    },
  };
}
