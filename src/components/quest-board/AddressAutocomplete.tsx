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

export function AddressAutocomplete({
  onChange,
  placeholder = "Start typing your address…",
  required,
  className = "mt-1 w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-amber-950 outline-none focus:border-amber-500",
}: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
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
        if (cancelled || !inputRef.current) return;

        const Autocomplete = window.google?.maps?.places?.Autocomplete;
        if (!Autocomplete) {
          throw new Error("Places Autocomplete did not load");
        }

        const input = inputRef.current;
        const bounds = new window.google!.maps!.LatLngBounds(
          new window.google!.maps!.LatLng(SF_BOUNDS.south, SF_BOUNDS.west),
          new window.google!.maps!.LatLng(SF_BOUNDS.north, SF_BOUNDS.east),
        );

        const autocomplete = new Autocomplete(input, {
          componentRestrictions: { country: "us" },
          fields: ["formatted_address", "geometry", "name"],
          bounds,
          strictBounds: false,
        });

        const listener = autocomplete.addListener("place_changed", () => {
          const place = autocomplete.getPlace();
          const address =
            place.formatted_address ?? place.name ?? input.value ?? "";
          if (address) {
            input.value = address;
            onChangeRef.current(address);
          }
        });

        cleanup = () => listener.remove();
        setReady(true);
      } catch (err) {
        if (!cancelled) {
          setLoadError(formatGoogleMapsError(err));
          setReady(true);
        }
      }
    }

    void init();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  return (
    <div className="relative z-50">
      <input
        ref={inputRef}
        type="text"
        name="businessAddress"
        placeholder={placeholder}
        autoComplete="off"
        required={required}
        className={className}
        onInput={(event) => onChangeRef.current(event.currentTarget.value)}
        onBlur={(event) => onChangeRef.current(event.currentTarget.value.trim())}
      />
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
