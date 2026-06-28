import type { Map } from "mapbox-gl";

const CARTOON_STYLE = "mapbox://styles/mapbox/streets-v12";

/** Layers we recolor for a soft, storybook map look. */
const LAYER_PAINT: Array<{
  layer: string;
  property: string;
  value: string | number;
}> = [
  { layer: "water", property: "fill-color", value: "#7ec8e3" },
  { layer: "land", property: "background-color", value: "#f5e6c8" },
  { layer: "landcover", property: "fill-color", value: "#b8e0a8" },
  { layer: "national-park", property: "fill-color", value: "#a8d88a" },
  { layer: "landuse", property: "fill-color", value: "#e8dcc8" },
  { layer: "building", property: "fill-color", value: "#f0e4d4" },
  { layer: "building", property: "fill-opacity", value: 0.85 },
  { layer: "road-simple", property: "line-color", value: "#ffffff" },
];

function safeSetPaint(
  map: Map,
  layerId: string,
  property: string,
  value: string | number,
) {
  if (!map.getLayer(layerId)) return;
  try {
    map.setPaintProperty(
      layerId,
      property as Parameters<Map["setPaintProperty"]>[1],
      value as Parameters<Map["setPaintProperty"]>[2],
    );
  } catch {
    // Style variants may omit some layers — ignore.
  }
}

export function getCartoonMapStyle(): string {
  return CARTOON_STYLE;
}

/** Apply pastel, cartoony overrides after the style loads. */
export function applyCartoonMapStyle(map: Map) {
  map.setFog({
    color: "#fff9f0",
    "high-color": "#fde68a",
    "horizon-blend": 0.08,
    "space-color": "#fff9f0",
  });

  for (const { layer, property, value } of LAYER_PAINT) {
    safeSetPaint(map, layer, property, value);
  }

  // Soften road labels
  if (map.getLayer("road-label-simple")) {
    safeSetPaint(map, "road-label-simple", "text-color", "#8b7355");
  }
}

export const SF_MAP_CENTER: [number, number] = [-122.4194, 37.7749];
export const SF_DEFAULT_ZOOM = 12.5;
