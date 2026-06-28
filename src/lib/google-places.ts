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

declare global {
  interface Window {
    google?: {
      maps?: {
        importLibrary: (library: "places" | string) => Promise<PlacesLibrary>;
      };
    };
  }
}

let loadPromise: Promise<PlacesLibrary> | null = null;

export function formatGoogleMapsError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/RefererNotAllowedMapError/i.test(msg)) {
    return "Google API key blocked this site — add https://yc-growth-hack.vercel.app/* and http://localhost:3000/* under HTTP referrers in Google Cloud Console.";
  }
  if (/ApiNotActivatedMapError|AccessNotConfigured|ApiTargetBlockedMapError/i.test(msg)) {
    return "Enable Maps JavaScript API and Places API (New) on your Google Cloud project (billing required).";
  }
  if (/could not load|did not load/i.test(msg)) {
    return "Google Maps script failed to load — check API key, billing, and network.";
  }
  return msg || "Google Places failed to load.";
}

function loadMapsScript(apiKey: string): Promise<void> {
  if (window.google?.maps?.importLibrary) {
    return Promise.resolve();
  }

  const existing = document.getElementById("google-maps-script");
  if (existing) {
    return new Promise((resolve, reject) => {
      if (window.google?.maps?.importLibrary) {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Google Maps script could not load")),
        { once: true },
      );
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.id = "google-maps-script";
    script.async = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&loading=async`;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google Maps script could not load"));
    document.head.appendChild(script);
  });
}

export function loadGooglePlaces(apiKey: string): Promise<PlacesLibrary> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Places is only available in the browser"));
  }

  if (loadPromise) return loadPromise;

  loadPromise = loadMapsScript(apiKey)
    .then(async () => {
      const importLibrary = window.google?.maps?.importLibrary;
      if (!importLibrary) {
        throw new Error("Google Maps importLibrary did not load");
      }
      return importLibrary("places");
    })
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
