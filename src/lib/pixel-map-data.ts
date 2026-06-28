import { lngLatToPixel } from "./pixel-map-projection";

export type MapLandmark = {
  id: string;
  name: string;
  lng: number;
  lat: number;
};

export type MapNeighborhood = {
  id: string;
  name: string;
  lng: number;
  lat: number;
};

/** Tourist landmarks placed by approximate SF geography. */
export const LANDMARKS: MapLandmark[] = [
  { id: "gg-bridge", name: "Golden Gate Bridge", lng: -122.4783, lat: 37.8199 },
  { id: "painted-ladies", name: "Painted Ladies", lng: -122.432, lat: 37.7766 },
  { id: "coit-tower", name: "Coit Tower", lng: -122.4058, lat: 37.8024 },
  { id: "transamerica", name: "Transamerica Pyramid", lng: -122.4028, lat: 37.7952 },
  { id: "ferry-building", name: "Ferry Building", lng: -122.3933, lat: 37.7955 },
  { id: "sutro-tower", name: "Sutro Tower", lng: -122.452, lat: 37.7551 },
  { id: "alcatraz", name: "Alcatraz", lng: -122.423, lat: 37.827 },
  { id: "palace-fine-arts", name: "Palace of Fine Arts", lng: -122.448, lat: 37.8029 },
  { id: "twin-peaks", name: "Twin Peaks", lng: -122.447, lat: 37.7544 },
  { id: "ggp-windmill", name: "Golden Gate Park Windmill", lng: -122.5105, lat: 37.766 },
  { id: "oracle-park", name: "Oracle Park", lng: -122.3893, lat: 37.7786 },
  { id: "lombard", name: "Lombard Street", lng: -122.4194, lat: 37.8021 },
];

/** Neighborhood signs — wood-plank labels on the illustrated map. */
export const NEIGHBORHOODS: MapNeighborhood[] = [
  { id: "marina", name: "Marina", lng: -122.436, lat: 37.803 },
  { id: "pacific-heights", name: "Pacific Heights", lng: -122.437, lat: 37.792 },
  { id: "richmond", name: "Richmond", lng: -122.475, lat: 37.78 },
  { id: "sunset", name: "Sunset", lng: -122.495, lat: 37.755 },
  { id: "mission", name: "Mission", lng: -122.419, lat: 37.759 },
  { id: "castro", name: "Castro", lng: -122.435, lat: 37.761 },
  { id: "noe-valley", name: "Noe Valley", lng: -122.433, lat: 37.75 },
  { id: "haight", name: "Haight", lng: -122.447, lat: 37.769 },
  { id: "nob-hill", name: "Nob Hill", lng: -122.416, lat: 37.793 },
  { id: "north-beach", name: "North Beach", lng: -122.41, lat: 37.804 },
  { id: "soma", name: "SoMa", lng: -122.4, lat: 37.778 },
  { id: "bayview", name: "Bayview", lng: -122.39, lat: 37.735 },
  { id: "bernal", name: "Bernal", lng: -122.415, lat: 37.742 },
  { id: "potrero", name: "Potrero", lng: -122.403, lat: 37.76 },
  { id: "excelsior", name: "Excelsior", lng: -122.428, lat: 37.728 },
  { id: "glen-park", name: "Glen Park", lng: -122.434, lat: 37.734 },
  { id: "western-addition", name: "Western Addition", lng: -122.432, lat: 37.782 },
  { id: "hayes-valley", name: "Hayes Valley", lng: -122.425, lat: 37.776 },
  { id: "financial-district", name: "Financial District", lng: -122.401, lat: 37.794 },
  { id: "chinatown", name: "Chinatown", lng: -122.406, lat: 37.794 },
  { id: "presidio", name: "Presidio", lng: -122.466, lat: 37.798 },
  { id: "twin-peaks-nb", name: "Twin Peaks", lng: -122.447, lat: 37.754 },
];

/** Decorative cactus scatter positions (pixel coords on map). */
export const CACTUS_POSITIONS = [
  { x: 180, y: 320 },
  { x: 340, y: 480 },
  { x: 520, y: 390 },
  { x: 680, y: 520 },
  { x: 820, y: 350 },
  { x: 950, y: 460 },
  { x: 420, y: 620 },
  { x: 760, y: 680 },
  { x: 290, y: 560 },
  { x: 1050, y: 580 },
];

export const TUMBLEWEED_POSITION = { x: 600, y: 710 };

/** Sailboats in the bay (pixel coords). */
export const SAILBOATS = [
  { x: 90, y: 120, color: "#f5e6c8" },
  { x: 200, y: 80, color: "#fde68a" },
  { x: 1050, y: 95, color: "#fef3c7" },
];

/** Simplified SF peninsula land silhouette (SVG path in map pixel space). */
export const LAND_SILHOUETTE_PATH = `
  M 0 0 L 1200 0 L 1200 900 L 0 900 Z
  M 0 280
  C 80 260, 140 220, 200 200
  C 280 175, 350 160, 420 155
  C 500 148, 580 145, 660 150
  C 740 155, 820 165, 900 180
  C 980 195, 1060 220, 1120 250
  C 1160 270, 1180 290, 1200 310
  L 1200 900 L 0 900 Z
`;

export function getLandmarkPixelPositions() {
  return LANDMARKS.map((lm) => ({
    ...lm,
    ...lngLatToPixel(lm.lng, lm.lat),
  }));
}

export function getNeighborhoodPixelPositions() {
  return NEIGHBORHOODS.map((nb) => ({
    ...nb,
    ...lngLatToPixel(nb.lng, nb.lat),
  }));
}
