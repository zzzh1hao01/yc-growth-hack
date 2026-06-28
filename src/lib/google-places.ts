declare global {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface Window {
    google?: any;
  }
}

let loadPromise: Promise<void> | null = null;

function ensureGoogleMapsBootstrap(apiKey: string): void {
  if (window.google?.maps?.importLibrary) return;
  if (document.getElementById("google-maps-bootstrap")) return;

  const script = document.createElement("script");
  script.id = "google-maps-bootstrap";
  // Official inline bootstrap loader — defines google.maps.importLibrary immediately.
  script.text = `(g=>{var h,a,k,p="The Google Maps JavaScript API",c="google",l="importLibrary",q="__ib__",m=document,b=window;b=b[c]||(b[c]={});var d=b.maps||(b.maps={}),r=new Set,e=new URLSearchParams,u=()=>h||(h=new Promise(async(f,n)=>{await (a=m.createElement("script"));e.set("libraries",[...r]+"");for(k in g)e.set(k.replace(/[A-Z]/g,t=>"_"+t[0].toLowerCase()),g[k]);e.set("callback",c+".maps."+q);d[q]=f;a.src=\`https://maps.\${c}apis.com/maps/api/js?\`+e;d[q]=f;a.onerror=()=>h=n(Error(p+" could not load."));a.nonce=m.querySelector("script[nonce]")?.nonce||"";m.head.append(a)}));d[l]?console.warn(p+" only loads once. Ignoring:",g):d[l]=(f,...n)=>r.add(f)&&u().then(()=>d[l](f,...n))})({key:${JSON.stringify(apiKey)},v:"weekly"});`;
  document.head.appendChild(script);
}

export function formatGoogleMapsError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/RefererNotAllowedMapError/i.test(msg)) {
    return "Google API key blocked this site — add https://yc-growth-hack.vercel.app/* and http://localhost:3000/* under HTTP referrers in Google Cloud Console.";
  }
  if (/ApiNotActivatedMapError|AccessNotConfigured|ApiTargetBlockedMapError/i.test(msg)) {
    return "Enable Maps JavaScript API and Places API (New) on your Google Cloud project (billing required).";
  }
  if (/could not load/i.test(msg)) {
    return "Google Maps script failed to load — check API key, billing, and network.";
  }
  return msg || "Google Places failed to load.";
}

export function loadGooglePlaces(apiKey: string): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    ensureGoogleMapsBootstrap(apiKey);

    if (!window.google?.maps?.importLibrary) {
      throw new Error("Google Maps bootstrap did not initialize");
    }

    await window.google.maps.importLibrary("places");
  })().catch((err) => {
    loadPromise = null;
    throw new Error(formatGoogleMapsError(err));
  });

  return loadPromise;
}
