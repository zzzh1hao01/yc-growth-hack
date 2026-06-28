"use client";

import { useEffect, useRef, useState } from "react";

import { formatGoogleMapsError, loadGooglePlaces } from "@/lib/google-places";

type AddressAutocompleteProps = {
  value: string;
  onChange: (address: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
};

const SF_BOUNDS = {
  south: 37.708,
  west: -122.515,
  north: 37.832,
  east: -122.355,
};

const SF_BIAS = { center: { lat: 37.7749, lng: -122.4194 }, radius: 12000 };

function styleAutocompleteHost(el: HTMLElement) {
  el.style.width = "100%";
  el.style.display = "block";
  el.style.backgroundColor = "#ffffff";
  el.style.border = "1px solid rgb(253 230 138)";
  el.style.borderRadius = "0.5rem";
  el.style.colorScheme = "light";
}

export function AddressAutocomplete({
  value,
  onChange,
  placeholder = "Start typing your address…",
  required,
  className,
}: AddressAutocompleteProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      setLoadError("Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.");
      return;
    }
    const mapsKey = apiKey;

    let cancelled = false;
    let cleanup: (() => void) | undefined;

    async function init() {
      try {
        await loadGooglePlaces(mapsKey);
        if (cancelled || !hostRef.current) return;

        const placesLib = await window.google.maps.importLibrary("places");

        if (placesLib.PlaceAutocompleteElement) {
          const el = new placesLib.PlaceAutocompleteElement({
            includedRegionCodes: ["us"],
          });
          el.placeholder = placeholder;
          el.locationBias = SF_BIAS;
          styleAutocompleteHost(el);
          if (className) el.className = className;

          const onSelect = async (event: Event) => {
            const selectEvent = event as {
              placePrediction?: { toPlace: () => { fetchFields: (opts: { fields: string[] }) => Promise<void>; formattedAddress?: string } };
            };
            if (!selectEvent.placePrediction) return;

            try {
              const place = selectEvent.placePrediction.toPlace();
              await place.fetchFields({ fields: ["formattedAddress"] });
              const address = place.formattedAddress;
              if (address) onChangeRef.current(address);
            } catch {
              // ignore fetch errors
            }
          };

          const onInput = () => {
            const text = (el as HTMLElement & { value?: string }).value?.trim();
            if (text) onChangeRef.current(text);
          };

          el.addEventListener("gmp-select", onSelect);
          el.addEventListener("input", onInput);

          hostRef.current.replaceChildren(el);
          cleanup = () => {
            el.removeEventListener("gmp-select", onSelect);
            el.removeEventListener("input", onInput);
          };
          setReady(true);
          return;
        }

        // Legacy Autocomplete fallback (requires classic Places API).
        const input = document.createElement("input");
        input.type = "text";
        input.placeholder = placeholder;
        input.autocomplete = "off";
        if (className) input.className = className;
        input.addEventListener("input", () => onChangeRef.current(input.value));
        input.addEventListener("blur", () =>
          onChangeRef.current(input.value.trim()),
        );

        hostRef.current.replaceChildren(input);

        const autocomplete = new placesLib.Autocomplete(input, {
          componentRestrictions: { country: "us" },
          fields: ["formatted_address", "geometry", "name"],
          types: ["address"],
          bounds: new window.google.maps.LatLngBounds(
            new window.google.maps.LatLng(SF_BOUNDS.south, SF_BOUNDS.west),
            new window.google.maps.LatLng(SF_BOUNDS.north, SF_BOUNDS.east),
          ),
          strictBounds: false,
        });

        const listener = autocomplete.addListener("place_changed", () => {
          const place = autocomplete.getPlace();
          const address =
            place.formatted_address ?? place.name ?? input.value ?? "";
          if (address) onChangeRef.current(address);
        });

        cleanup = () => listener.remove();
        setReady(true);
      } catch (err) {
        if (!cancelled) {
          setLoadError(formatGoogleMapsError(err));
        }
      }
    }

    void init();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [className, placeholder]);

  useEffect(() => {
    if (value !== "" || !hostRef.current) return;
    const input = hostRef.current.querySelector("input");
    if (input instanceof HTMLInputElement) input.value = "";
    const widget = hostRef.current.querySelector("gmp-place-autocomplete") as
      | (HTMLElement & { value?: string })
      | null;
    if (widget && "value" in widget) widget.value = "";
  }, [value]);

  return (
    <div>
      <div
        ref={hostRef}
        className={`householdiq-autocomplete-host min-h-[42px] ${ready ? "" : "opacity-80"}`}
      />
      {!ready && !loadError && (
        <p className="mt-1 text-[10px] text-amber-800/60">Loading address search…</p>
      )}
      {required && (
        <input
          tabIndex={-1}
          aria-hidden
          required
          value={value}
          readOnly
          className="pointer-events-none absolute h-0 w-0 opacity-0"
          onChange={() => {}}
        />
      )}
      {loadError && (
        <p className="mt-1 text-[10px] leading-snug text-red-800">{loadError}</p>
      )}
    </div>
  );
}
