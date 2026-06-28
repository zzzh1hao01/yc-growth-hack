import type { Map } from "mapbox-gl";

const CARTOON_STYLE = "mapbox://styles/mapbox/streets-v12";

/** Base layer recolors — desert land, sage parks, turquoise bay. */
const LAYER_PAINT: Array<{
  layer: string;
  property: string;
  value: string | number;
}> = [
  { layer: "water", property: "fill-color", value: "#8ec4d4" },
  { layer: "land", property: "background-color", value: "#f0e0b8" },
  { layer: "landcover", property: "fill-color", value: "#b8d4a8" },
  { layer: "national-park", property: "fill-color", value: "#a8c898" },
  { layer: "landuse", property: "fill-color", value: "#e8dcc8" },
  { layer: "building", property: "fill-color", value: "#dcc8a8" },
  { layer: "building", property: "fill-opacity", value: 0.88 },
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

function roadLineColor(layerId: string): string {
  if (/motorway|trunk|primary|major|highway/i.test(layerId)) {
    return "#fffbf5";
  }
  if (/secondary|tertiary|street|link/i.test(layerId)) {
    return "#f8eed8";
  }
  return "#f0e4cc";
}

/** Recolor roads and labels while keeping grid detail and street names visible. */
function applyWesternRoadAndLabelStyle(map: Map) {
  const layers = map.getStyle()?.layers ?? [];

  for (const layer of layers) {
    const id = layer.id;

    if (layer.type === "line" && id.includes("road")) {
      safeSetPaint(map, id, "line-color", roadLineColor(id));
      if (id.includes("case") || id.includes("major")) {
        safeSetPaint(map, id, "line-width", 2.5);
      }
    }

    if (layer.type === "symbol" && (id.includes("road") || id.includes("street")) && id.includes("label")) {
      safeSetPaint(map, id, "text-color", "#8b7355");
      safeSetPaint(map, id, "text-halo-color", "#faf3e6");
      safeSetPaint(map, id, "text-halo-width", 1.25);
    }

    if (layer.type === "symbol" && id.includes("place") && id.includes("label")) {
      safeSetPaint(map, id, "text-color", "#6b5344");
      safeSetPaint(map, id, "text-halo-color", "#fef3c7");
      safeSetPaint(map, id, "text-halo-width", 1.5);
    }

    if (layer.type === "symbol" && id.includes("poi") && id.includes("label")) {
      safeSetPaint(map, id, "text-color", "#a67c52");
      safeSetPaint(map, id, "text-halo-color", "#faf3e6");
      safeSetPaint(map, id, "text-halo-width", 1);
    }
  }
}

export function getCartoonMapStyle(): string {
  return CARTOON_STYLE;
}

/** Vibrant wild-west palette on real Mapbox streets (roads + labels preserved). */
export function applyCartoonMapStyle(map: Map) {
  map.setFog({
    color: "#fde8c0",
    "high-color": "#fbbf24",
    "horizon-blend": 0.14,
    "space-color": "#faf3e6",
  });

  for (const { layer, property, value } of LAYER_PAINT) {
    safeSetPaint(map, layer, property, value);
  }

  applyWesternRoadAndLabelStyle(map);
}

export const SF_MAP_CENTER: [number, number] = [-122.4194, 37.7749];
export const SF_DEFAULT_ZOOM = 12.5;
