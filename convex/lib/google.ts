import { haversineMiles } from "./geo";

export type GeocodeResult = {
  lat: number;
  lng: number;
  formattedAddress: string;
};

function mapsApiKey(): string | null {
  return process.env.GOOGLE_MAPS_API_KEY ?? null;
}

function humanizePlaceType(type: string): string {
  return type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function primaryPlaceType(types: string[] | undefined): string | undefined {
  if (!types?.length) return undefined;
  const skip = new Set([
    "point_of_interest",
    "establishment",
    "premise",
    "street_address",
    "subpremise",
  ]);
  const match = types.find((type) => !skip.has(type));
  return match ? humanizePlaceType(match) : humanizePlaceType(types[0]);
}

export async function geocodeAddress(address: string): Promise<GeocodeResult> {
  const apiKey = mapsApiKey();
  if (!apiKey) {
    throw new Error("GOOGLE_MAPS_API_KEY is not configured in Convex environment");
  }

  const query = address.includes("San Francisco")
    ? address
    : `${address}, San Francisco, CA`;

  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", query);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("region", "us");

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Geocoding HTTP error ${response.status}`);
  }

  const data = (await response.json()) as {
    status: string;
    results: Array<{
      formatted_address: string;
      geometry: { location: { lat: number; lng: number } };
    }>;
  };

  if (data.status !== "OK" || !data.results[0]) {
    throw new Error(
      `Could not verify business address (${data.status}). Use a valid San Francisco address.`,
    );
  }

  const result = data.results[0];
  return {
    lat: result.geometry.location.lat,
    lng: result.geometry.location.lng,
    formattedAddress: result.formatted_address,
  };
}

type PlaceDetails = {
  name?: string;
  formatted_address?: string;
  formatted_phone_number?: string;
  website?: string;
  rating?: number;
  user_ratings_total?: number;
  types?: string[];
  business_status?: string;
  url?: string;
};

function normalizeBusinessContext(details: PlaceDetails): Record<string, unknown> {
  const primaryType = primaryPlaceType(details.types);
  const rating =
    typeof details.rating === "number"
      ? `${details.rating.toFixed(1)}★${
          details.user_ratings_total ? ` (${details.user_ratings_total} reviews)` : ""
        }`
      : undefined;

  const headlineParts = [primaryType, rating, details.business_status].filter(Boolean);
  const descriptionParts = [
    details.formatted_address,
    details.formatted_phone_number,
  ].filter(Boolean);

  return {
    source: "google-places",
    name: details.name,
    headline: headlineParts.join(" · "),
    description: descriptionParts.join(" · "),
    address: details.formatted_address,
    phone: details.formatted_phone_number,
    website: details.website,
    rating: details.rating,
    numReviews: details.user_ratings_total,
    primaryType,
    googleMapsUrl: details.url,
    types: details.types,
  };
}

type TextSearchResult = {
  place_id?: string;
  name?: string;
  formatted_address?: string;
  geometry?: { location?: { lat?: number; lng?: number } };
  rating?: number;
  user_ratings_total?: number;
  types?: string[];
  business_status?: string;
};

function isLikelyBusinessListing(result: TextSearchResult): boolean {
  const types = result.types ?? [];
  if (types.length === 0) return Boolean(result.rating);

  const nonBusinessOnly = types.every((type) =>
    [
      "premise",
      "street_address",
      "subpremise",
      "route",
      "locality",
      "political",
      "administrative_area_level_1",
      "administrative_area_level_2",
      "country",
      "postal_code",
      "neighborhood",
    ].includes(type),
  );
  return !nonBusinessOnly;
}

async function textSearchPlaces(
  apiKey: string,
  query: string,
): Promise<TextSearchResult[]> {
  const url = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json");
  url.searchParams.set("query", query);
  url.searchParams.set("key", apiKey);

  const response = await fetch(url.toString());
  if (!response.ok) return [];

  const data = (await response.json()) as {
    status: string;
    results?: TextSearchResult[];
  };

  if (data.status !== "OK") return [];
  return data.results ?? [];
}

function pickBestTextSearchResult(
  results: TextSearchResult[],
  lat: number,
  lng: number,
): TextSearchResult | null {
  const candidates = results.filter(isLikelyBusinessListing);
  if (candidates.length === 0) return results[0] ?? null;

  return candidates
    .map((result) => {
      const resultLat = result.geometry?.location?.lat;
      const resultLng = result.geometry?.location?.lng;
      const distanceMiles =
        resultLat != null && resultLng != null
          ? haversineMiles(lat, lng, resultLat, resultLng)
          : 99;
      return { result, distanceMiles };
    })
    .sort((a, b) => a.distanceMiles - b.distanceMiles)[0]?.result ?? null;
}

async function fetchPlaceDetails(
  apiKey: string,
  placeId: string,
): Promise<PlaceDetails | null> {
  const detailsUrl = new URL("https://maps.googleapis.com/maps/api/place/details/json");
  detailsUrl.searchParams.set("place_id", placeId);
  detailsUrl.searchParams.set(
    "fields",
    "name,formatted_address,formatted_phone_number,website,rating,user_ratings_total,types,business_status,url",
  );
  detailsUrl.searchParams.set("key", apiKey);

  const detailsResponse = await fetch(detailsUrl.toString());
  if (!detailsResponse.ok) return null;

  const detailsData = (await detailsResponse.json()) as {
    status: string;
    result?: PlaceDetails;
  };

  if (detailsData.status !== "OK" || !detailsData.result) return null;
  return detailsData.result;
}

export async function lookupBusinessContext(
  addressQuery: string,
  formattedAddress: string,
  lat: number,
  lng: number,
): Promise<Record<string, unknown> | null> {
  const apiKey = mapsApiKey();
  if (!apiKey) return null;

  const queries = [...new Set([addressQuery.trim(), formattedAddress.trim()])].filter(
    Boolean,
  );

  for (const query of queries) {
    const results = await textSearchPlaces(apiKey, query);
    const best = pickBestTextSearchResult(results, lat, lng);
    if (!best?.place_id) continue;

    const details = await fetchPlaceDetails(apiKey, best.place_id);
    if (details) return normalizeBusinessContext(details);
  }

  return null;
}
