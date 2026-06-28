/** SF bounding box for lat/lng → pixel map projection. */
export const SF_BOUNDS = {
  north: 37.815,
  south: 37.708,
  west: -122.515,
  east: -122.355,
} as const;

export const MAP_WIDTH = 1200;
export const MAP_HEIGHT = 900;

export type PixelPoint = { x: number; y: number };

export function lngLatToPixel(lng: number, lat: number): PixelPoint {
  const { north, south, west, east } = SF_BOUNDS;
  const x = ((lng - west) / (east - west)) * MAP_WIDTH;
  const y = ((north - lat) / (north - south)) * MAP_HEIGHT;
  return { x, y };
}

export function pixelToLngLat(x: number, y: number): { lng: number; lat: number } {
  const { north, south, west, east } = SF_BOUNDS;
  const lng = west + (x / MAP_WIDTH) * (east - west);
  const lat = north - (y / MAP_HEIGHT) * (north - south);
  return { lng, lat };
}

export type MapViewport = {
  panX: number;
  panY: number;
  scale: number;
};

/** Project a lat/lng lead position to screen coordinates inside the map container. */
export function projectToScreen(
  lng: number,
  lat: number,
  viewport: MapViewport,
  containerWidth: number,
  containerHeight: number,
): PixelPoint {
  const { x, y } = lngLatToPixel(lng, lat);
  const mapScreenW = MAP_WIDTH * viewport.scale;
  const mapScreenH = MAP_HEIGHT * viewport.scale;
  const offsetX = (containerWidth - mapScreenW) / 2 + viewport.panX;
  const offsetY = (containerHeight - mapScreenH) / 2 + viewport.panY;
  return {
    x: offsetX + x * viewport.scale,
    y: offsetY + y * viewport.scale,
  };
}

/** Compute initial viewport to fit a set of pixel points with padding. */
export function fitViewportToPoints(
  points: PixelPoint[],
  containerWidth: number,
  containerHeight: number,
  padding = 80,
): MapViewport {
  if (points.length === 0 || containerWidth <= 0 || containerHeight <= 0) {
    return { panX: 0, panY: 0, scale: 1 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }

  const boundsW = Math.max(maxX - minX, 40);
  const boundsH = Math.max(maxY - minY, 40);
  const scaleX = (containerWidth - padding * 2) / boundsW;
  const scaleY = (containerHeight - padding * 2) / boundsH;
  const scale = Math.min(scaleX, scaleY, 2.2);

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const mapScreenW = MAP_WIDTH * scale;
  const mapScreenH = MAP_HEIGHT * scale;
  const baseOffsetX = (containerWidth - mapScreenW) / 2;
  const baseOffsetY = (containerHeight - mapScreenH) / 2;

  const panX = containerWidth / 2 - (baseOffsetX + centerX * scale);
  const panY = containerHeight / 2 - (baseOffsetY + centerY * scale);

  return { panX, panY, scale };
}
