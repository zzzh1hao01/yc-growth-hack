import { importLibrary, setOptions } from "@googlemaps/js-api-loader";

export interface PlaceAutocompleteElementOptions {
  includedRegionCodes?: string[];
  locationBias?: {
    radius: number;
    center: { lat: number; lng: number };
  };
  includedPrimaryTypes?: string[];
}

export interface PlaceAutocompleteElement extends HTMLElement {
  placeholder: string;
  includedRegionCodes: string[];
  locationBias: PlaceAutocompleteElementOptions["locationBias"] | null;
  includedPrimaryTypes: string[];
  addEventListener(
    type: "gmp-select",
    listener: (event: PlacePredictionSelectEvent) => void,
  ): void;
  addEventListener(type: "input", listener: (event: Event) => void): void;
}

export interface PlacePredictionSelectEvent extends Event {
  placePrediction: {
    toPlace: () => PlaceResult;
  };
}

export interface PlaceResult {
  fetchFields: (options: { fields: string[] }) => Promise<void>;
  formattedAddress?: string;
  location?: { lat: number; lng: number };
}

export interface PlacesLibrary {
  PlaceAutocompleteElement: new (
    options?: PlaceAutocompleteElementOptions,
  ) => PlaceAutocompleteElement;
}

let loadPromise: Promise<PlacesLibrary> | null = null;
let configuredKey: string | null = null;

export function formatGoogleMapsError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/RefererNotAllowedMapError/i.test(msg)) {
    return "Google API key blocked this site — add https://yc-growth-hack.vercel.app/* and http://localhost:3000/* under HTTP referrers in Google Cloud Console.";
  }
  if (/ApiNotActivatedMapError|AccessNotConfigured|ApiTargetBlockedMapError/i.test(msg)) {
    return "Enable Maps JavaScript API and Places API (New) on your Google Cloud project (billing required).";
  }
  if (/could not load|did not load|failed to load/i.test(msg)) {
    return "Google Maps script failed to load — check API key, billing, and network.";
  }
  return msg || "Google Places failed to load.";
}

export function loadGooglePlaces(apiKey: string): Promise<PlacesLibrary> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Places is only available in the browser"));
  }

  if (configuredKey !== apiKey) {
    configuredKey = apiKey;
    loadPromise = null;
    setOptions({ key: apiKey, v: "weekly" });
  }

  if (loadPromise) return loadPromise;

  loadPromise = importLibrary("places")
    .then((library) => library as PlacesLibrary)
    .catch((err) => {
      loadPromise = null;
      throw new Error(formatGoogleMapsError(err));
    });

  return loadPromise;
}

export function readPlaceAutocompleteValue(element: PlaceAutocompleteElement): string {
  const input = element.shadowRoot?.querySelector("input");
  return input?.value ?? "";
}
