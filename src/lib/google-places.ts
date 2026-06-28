declare global {
  interface Window {
    google?: {
      maps?: {
        places?: {
          Autocomplete: new (
            input: HTMLInputElement,
            opts?: Record<string, unknown>,
          ) => {
            getPlace: () => {
              formatted_address?: string;
              name?: string;
            };
            addListener: (event: string, handler: () => void) => { remove: () => void };
          };
        };
        LatLng: new (lat: number, lng: number) => unknown;
        LatLngBounds: new (sw: unknown, ne: unknown) => unknown;
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      [key: string]: any;
    };
  }
}

let loadPromise: Promise<void> | null = null;

export function formatGoogleMapsError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/RefererNotAllowedMapError/i.test(msg)) {
    return "Google API key blocked this site — add https://yc-growth-hack.vercel.app/* and http://localhost:3000/* under HTTP referrers in Google Cloud Console.";
  }
  if (/ApiNotActivatedMapError|AccessNotConfigured|ApiTargetBlockedMapError/i.test(msg)) {
    return "Enable Maps JavaScript API and Places API on your Google Cloud project (billing required).";
  }
  if (/could not load|did not load/i.test(msg)) {
    return "Google Maps script failed to load — check API key, billing, and network.";
  }
  return msg || "Google Places failed to load.";
}

export function loadGooglePlaces(apiKey: string): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();

  if (window.google?.maps?.places?.Autocomplete) {
    return Promise.resolve();
  }

  if (loadPromise) return loadPromise;

  loadPromise = new Promise<void>((resolve, reject) => {
    const callbackName = "__householdiqMapsInit";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any;
    win[callbackName] = () => {
      delete win[callbackName];
      if (window.google?.maps?.places?.Autocomplete) {
        resolve();
        return;
      }
      reject(new Error("Places Autocomplete did not load"));
    };

    const existing = document.getElementById("google-maps-places-script");
    if (existing) {
      existing.addEventListener("load", () => win[callbackName]?.());
      existing.addEventListener("error", () => reject(new Error("Google Maps script could not load")));
      return;
    }

    const script = document.createElement("script");
    script.id = "google-maps-places-script";
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&callback=${callbackName}&loading=async`;
    script.onerror = () => reject(new Error("Google Maps script could not load"));
    document.head.appendChild(script);
  }).catch((err) => {
    loadPromise = null;
    throw new Error(formatGoogleMapsError(err));
  });

  return loadPromise;
}
