import { haversineMiles } from "./geo";

export type RegionBounds = {
  south: number;
  north: number;
  west: number;
  east: number;
};

export type SFRegion = {
  id: string;
  name: string;
  bounds: RegionBounds;
};

/**
 * SF Planning analysis neighborhoods — approximate bounding boxes.
 * Listed with smaller / more specific areas first so point lookup prefers them.
 */
export const SF_REGIONS: SFRegion[] = [
  { id: "dogpatch", name: "Dogpatch", bounds: { south: 37.756, north: 37.772, west: -122.398, east: -122.378 } },
  { id: "treasure_island", name: "Treasure Island", bounds: { south: 37.818, north: 37.835, west: -122.385, east: -122.355 } },
  { id: "financial_district", name: "Financial District / South Beach", bounds: { south: 37.786, north: 37.798, west: -122.402, east: -122.382 } },
  { id: "tenderloin", name: "Tenderloin", bounds: { south: 37.782, north: 37.788, west: -122.418, east: -122.408 } },
  { id: "chinatown", name: "Chinatown", bounds: { south: 37.788, north: 37.798, west: -122.412, east: -122.400 } },
  { id: "north_beach", name: "North Beach", bounds: { south: 37.798, north: 37.808, west: -122.418, east: -122.400 } },
  { id: "russian_hill", name: "Russian Hill", bounds: { south: 37.792, north: 37.802, west: -122.428, east: -122.412 } },
  { id: "nob_hill", name: "Nob Hill", bounds: { south: 37.788, north: 37.798, west: -122.422, east: -122.408 } },
  { id: "marina", name: "Marina", bounds: { south: 37.796, north: 37.808, west: -122.452, east: -122.428 } },
  { id: "pacific_heights", name: "Pacific Heights", bounds: { south: 37.786, north: 37.798, west: -122.452, east: -122.424 } },
  { id: "presidio_heights", name: "Presidio Heights", bounds: { south: 37.786, north: 37.796, west: -122.452, east: -122.438 } },
  { id: "japantown", name: "Japantown", bounds: { south: 37.784, north: 37.792, west: -122.438, east: -122.428 } },
  { id: "western_addition", name: "Western Addition", bounds: { south: 37.778, north: 37.788, west: -122.438, east: -122.422 } },
  { id: "hayes_valley", name: "Hayes Valley", bounds: { south: 37.772, north: 37.782, west: -122.428, east: -122.412 } },
  { id: "downtown", name: "Downtown / Civic Center", bounds: { south: 37.778, north: 37.788, west: -122.422, east: -122.408 } },
  { id: "soma", name: "SoMa", bounds: { south: 37.772, north: 37.788, west: -122.408, east: -122.388 } },
  { id: "potrero_hill", name: "Potrero Hill", bounds: { south: 37.756, north: 37.774, west: -122.408, east: -122.388 } },
  { id: "bayview", name: "Bayview / Hunters Point", bounds: { south: 37.718, north: 37.742, west: -122.402, east: -122.372 } },
  { id: "visitacion_valley", name: "Visitacion Valley", bounds: { south: 37.708, north: 37.722, west: -122.418, east: -122.398 } },
  { id: "mclaren_park", name: "McLaren Park", bounds: { south: 37.712, north: 37.728, west: -122.418, east: -122.398 } },
  { id: "crocker_amazon", name: "Crocker Amazon", bounds: { south: 37.712, north: 37.726, west: -122.438, east: -122.418 } },
  { id: "bernal_heights", name: "Bernal Heights", bounds: { south: 37.734, north: 37.748, west: -122.422, east: -122.398 } },
  { id: "outer_mission", name: "Outer Mission", bounds: { south: 37.728, north: 37.742, west: -122.428, east: -122.408 } },
  { id: "mission", name: "Mission", bounds: { south: 37.742, north: 37.764, west: -122.428, east: -122.404 } },
  { id: "noe_valley", name: "Noe Valley", bounds: { south: 37.736, north: 37.752, west: -122.448, east: -122.424 } },
  { id: "glen_park", name: "Glen Park", bounds: { south: 37.732, north: 37.742, west: -122.448, east: -122.432 } },
  { id: "diamond_heights", name: "Diamond Heights", bounds: { south: 37.728, north: 37.742, west: -122.442, east: -122.422 } },
  { id: "castro", name: "Castro / Upper Market", bounds: { south: 37.752, north: 37.768, west: -122.448, east: -122.424 } },
  { id: "twin_peaks", name: "Twin Peaks", bounds: { south: 37.748, north: 37.758, west: -122.458, east: -122.442 } },
  { id: "haight", name: "Haight Ashbury", bounds: { south: 37.764, north: 37.774, west: -122.458, east: -122.442 } },
  { id: "lone_mountain", name: "Lone Mountain / USF", bounds: { south: 37.776, north: 37.786, west: -122.458, east: -122.448 } },
  { id: "inner_richmond", name: "Inner Richmond", bounds: { south: 37.774, north: 37.788, west: -122.478, east: -122.458 } },
  { id: "presidio", name: "Presidio", bounds: { south: 37.788, north: 37.808, west: -122.478, east: -122.448 } },
  { id: "seacliff", name: "Lincoln Park / Seacliff", bounds: { south: 37.782, north: 37.792, west: -122.502, east: -122.478 } },
  { id: "outer_richmond", name: "Outer Richmond", bounds: { south: 37.772, north: 37.788, west: -122.515, east: -122.478 } },
  { id: "inner_sunset", name: "Inner Sunset", bounds: { south: 37.752, north: 37.768, west: -122.472, east: -122.448 } },
  { id: "west_of_twin_peaks", name: "West of Twin Peaks", bounds: { south: 37.732, north: 37.752, west: -122.478, east: -122.448 } },
  { id: "parkside", name: "Parkside", bounds: { south: 37.738, north: 37.752, west: -122.498, east: -122.478 } },
  { id: "sunset_parkside", name: "Sunset / Parkside", bounds: { south: 37.726, north: 37.768, west: -122.515, east: -122.468 } },
  { id: "lakeshore", name: "Lakeshore", bounds: { south: 37.718, north: 37.728, west: -122.498, east: -122.478 } },
  { id: "oceanview", name: "Oceanview / Merced / Ingleside", bounds: { south: 37.708, north: 37.728, west: -122.468, east: -122.448 } },
  { id: "excelsior", name: "Excelsior", bounds: { south: 37.718, north: 37.732, west: -122.442, east: -122.418 } },
];

const REGION_BY_ID = new Map(SF_REGIONS.map((r) => [r.id, r]));

/** ~350m gap tolerance — treats touching planning neighborhoods as adjacent. */
const ADJACENCY_MARGIN = 0.003;

/** Max neighborhoods in a contractor canvassing zone (home + neighbors). */
const MAX_SERVICE_REGIONS = 5;

function regionArea(region: SFRegion): number {
  const { south, north, west, east } = region.bounds;
  return Math.max(0, north - south) * Math.max(0, east - west);
}

function regionCenter(region: SFRegion): { lat: number; lng: number } {
  return {
    lat: (region.bounds.south + region.bounds.north) / 2,
    lng: (region.bounds.west + region.bounds.east) / 2,
  };
}

export function pointInBounds(
  lat: number,
  lng: number,
  bounds: RegionBounds,
): boolean {
  return (
    lat >= bounds.south &&
    lat <= bounds.north &&
    lng >= bounds.west &&
    lng <= bounds.east
  );
}

function boundsAdjacent(a: RegionBounds, b: RegionBounds): boolean {
  const latOverlap =
    a.south - ADJACENCY_MARGIN <= b.north + ADJACENCY_MARGIN &&
    a.north + ADJACENCY_MARGIN >= b.south - ADJACENCY_MARGIN;
  const lngOverlap =
    a.west - ADJACENCY_MARGIN <= b.east + ADJACENCY_MARGIN &&
    a.east + ADJACENCY_MARGIN >= b.west - ADJACENCY_MARGIN;
  return latOverlap && lngOverlap;
}

function adjacentRegionIds(primary: SFRegion): string[] {
  const center = regionCenter(primary);
  const neighbors = SF_REGIONS.filter(
    (candidate) =>
      candidate.id !== primary.id &&
      boundsAdjacent(primary.bounds, candidate.bounds),
  )
    .map((candidate) => ({
      id: candidate.id,
      distance: haversineMiles(
        center.lat,
        center.lng,
        regionCenter(candidate).lat,
        regionCenter(candidate).lng,
      ),
    }))
    .sort((a, b) => a.distance - b.distance);

  const ids = [primary.id];
  for (const neighbor of neighbors) {
    if (ids.length >= MAX_SERVICE_REGIONS) break;
    if (!ids.includes(neighbor.id)) ids.push(neighbor.id);
  }
  return ids;
}

export function findNearestRegion(lat: number, lng: number): SFRegion | null {
  let best: SFRegion | null = null;
  let bestDist = Infinity;

  for (const region of SF_REGIONS) {
    const center = regionCenter(region);
    const dist = haversineMiles(lat, lng, center.lat, center.lng);
    if (dist < bestDist) {
      bestDist = dist;
      best = region;
    }
  }

  return best;
}

export function findPrimaryRegion(lat: number, lng: number): SFRegion | null {
  const matches = SF_REGIONS.filter((region) =>
    pointInBounds(lat, lng, region.bounds),
  );

  if (matches.length === 0) {
    return findNearestRegion(lat, lng);
  }

  return matches.sort((a, b) => regionArea(a) - regionArea(b))[0];
}

export function resolveServiceAreas(lat: number, lng: number): {
  primaryId: string;
  regionIds: string[];
  label: string;
} {
  const primary = findPrimaryRegion(lat, lng);
  if (!primary) {
    return {
      primaryId: "san_francisco",
      regionIds: [],
      label: "San Francisco",
    };
  }

  const regionIds = adjacentRegionIds(primary);
  const label = regionIds
    .map((id) => REGION_BY_ID.get(id)?.name ?? id)
    .join(" · ");

  return {
    primaryId: primary.id,
    regionIds,
    label,
  };
}

export function leadRegionId(lat: number, lng: number): string | null {
  return findPrimaryRegion(lat, lng)?.id ?? null;
}

export function leadInServiceAreas(
  lat: number,
  lng: number,
  serviceRegionIds: string[],
): boolean {
  if (serviceRegionIds.length === 0) return true;
  const leadRegion = leadRegionId(lat, lng);
  if (!leadRegion) return false;
  return serviceRegionIds.includes(leadRegion);
}

export function regionName(regionId: string): string {
  return REGION_BY_ID.get(regionId)?.name ?? regionId;
}
