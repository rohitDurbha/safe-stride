/**
 * Address suggestions from the public Nominatim server, limited to Oakland.
 *
 * Nominatim's usage policy allows at most one request per second, so every
 * search goes through one shared pacer. Browsers do not allow a custom
 * User-Agent header, and Nominatim identifies browser apps by their Referer.
 */
export type LatLon = [number, number];

export interface Place {
  name: string;
  coords: LatLon;
}

export const NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search";
export const OAKLAND_VIEWBOX = "-122.35,37.90,-122.15,37.70";
export const MIN_QUERY_LENGTH = 3;
export const MAX_PLACES = 5;

/** Turn a Nominatim reply into places with numeric coordinates. */
export function parsePlaces(data: unknown): Place[] {
  if (!Array.isArray(data)) return [];
  return data
    .map((item) => ({
      name: typeof item?.display_name === "string" ? item.display_name : "",
      coords: [Number(item?.lat), Number(item?.lon)] as LatLon,
    }))
    .filter((place) => place.name && place.coords.every(Number.isFinite))
    .slice(0, MAX_PLACES);
}

export function placeSearchUrl(query: string): string {
  const params = new URLSearchParams({
    format: "json",
    q: query,
    viewbox: OAKLAND_VIEWBOX,
    bounded: "1",
    limit: String(MAX_PLACES),
  });
  return `${NOMINATIM_SEARCH_URL}?${params.toString()}`;
}

interface Clock {
  now: () => number;
  sleep: (ms: number) => Promise<void>;
}

const realClock: Clock = {
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

/** Build a search function that never sends two requests within minIntervalMs. */
export function createPlaceSearch(
  fetcher: typeof fetch = (input, init) => fetch(input, init),
  minIntervalMs = 1000,
  clock: Clock = realClock,
) {
  let nextAllowedAt = 0;

  return async function searchPlaces(query: string): Promise<Place[]> {
    const q = query.trim();
    if (q.length < MIN_QUERY_LENGTH) return [];

    const now = clock.now();
    const wait = Math.max(0, nextAllowedAt - now);
    nextAllowedAt = Math.max(now, nextAllowedAt) + minIntervalMs;
    if (wait > 0) await clock.sleep(wait);

    const res = await fetcher(placeSearchUrl(q), { headers: { "Accept-Language": "en" } });
    if (!res.ok) throw new Error(`Address search answered ${res.status}`);
    return parsePlaces(await res.json());
  };
}

export const searchPlaces = createPlaceSearch();

/** The first part of a Nominatim address, which is the place's own name. */
export function shortName(name: string): string {
  return name.split(", ")[0] || name;
}
