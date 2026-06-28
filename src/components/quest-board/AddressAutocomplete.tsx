"use client";

import { useEffect, useRef, useState } from "react";

import {
  formatGoogleMapsError,
  loadGooglePlaces,
  readPlaceAutocompleteValue,
  type PlacePredictionSelectEvent,
} from "@/lib/google-places";

type AddressAutocompleteProps = {
  onChange: (address: string) => void;
  placeholder?: string;
  className?: string;
};

const SF_CENTER = { lat: 37.77, lng: -122.42 };
const SF_BIAS_RADIUS_METERS = 8000;
const mapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

export function AddressAutocomplete({
  onChange,
  placeholder = "Start typing your address…",
  className = "mt-1 w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-amber-950 outline-none focus:border-amber-500",
}: AddressAutocompleteProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  const [ready, setReady] = useState(!mapsApiKey);
  const [loadError, setLoadError] = useState<string | null>(
    mapsApiKey ? null : "Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.",
  );
  const [useFallbackInput, setUseFallbackInput] = useState(!mapsApiKey);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const apiKey = mapsApiKey;
    if (!apiKey) return;

    let cancelled = false;
    let cleanup: (() => void) | undefined;

    async function init(resolvedApiKey: string) {
      try {
        const { PlaceAutocompleteElement } = await loadGooglePlaces(resolvedApiKey);
        if (cancelled || !containerRef.current) return;

        const autocomplete = new PlaceAutocompleteElement({
          includedRegionCodes: ["us"],
          locationBias: {
            radius: SF_BIAS_RADIUS_METERS,
            center: SF_CENTER,
          },
          includedPrimaryTypes: ["street_address", "premise", "subpremise"],
        });

        autocomplete.placeholder = placeholder;
        autocomplete.className = `address-autocomplete-input ${className}`;

        const handleInput = () => {
          onChangeRef.current(readPlaceAutocompleteValue(autocomplete).trim());
        };

        const handleSelect = (event: Event) => {
          void (async () => {
            const selectEvent = event as PlacePredictionSelectEvent;
            const place = selectEvent.placePrediction.toPlace();
            await place.fetchFields({ fields: ["formattedAddress", "location"] });
            const address =
              place.formattedAddress ?? readPlaceAutocompleteValue(autocomplete);
            if (address) {
              onChangeRef.current(address);
            }
          })();
        };

        autocomplete.addEventListener("input", handleInput);
        autocomplete.addEventListener("gmp-select", handleSelect);

        containerRef.current.replaceChildren(autocomplete);

        cleanup = () => {
          autocomplete.removeEventListener("input", handleInput);
          autocomplete.removeEventListener("gmp-select", handleSelect);
          autocomplete.remove();
        };

        setReady(true);
      } catch (err) {
        if (!cancelled) {
          setLoadError(formatGoogleMapsError(err));
          setUseFallbackInput(true);
          setReady(true);
        }
      }
    }

    void init(apiKey);

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [className, placeholder]);

  return (
    <div className="address-autocomplete-host relative z-50">
      {useFallbackInput ? (
        <input
          type="text"
          name="businessAddress"
          placeholder={placeholder}
          autoComplete="off"
          className={className}
          onInput={(event) => onChangeRef.current(event.currentTarget.value)}
          onBlur={(event) => onChangeRef.current(event.currentTarget.value.trim())}
        />
      ) : (
        <div ref={containerRef} className="address-autocomplete-mount" />
      )}
      {!ready && !loadError && (
        <p className="mt-1 text-[10px] text-amber-800/60">Loading address search…</p>
      )}
      {ready && !loadError && (
        <p className="mt-1 text-[10px] text-amber-800/60">
          Type an address — pick a suggestion or enter one manually.
        </p>
      )}
      {loadError && (
        <p className="mt-1 text-[10px] leading-snug text-red-800">
          {loadError} You can still type your address manually.
        </p>
      )}
    </div>
  );
}
