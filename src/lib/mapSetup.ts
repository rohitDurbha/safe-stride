export type LatLon = [number, number];

/** Downtown Oakland, the area the street graph covers. */
export const DEFAULT_LOCATION: LatLon = [37.8044, -122.2711];
export const LOCATION_STORAGE_KEY = "safeStride_userLocation";

/** Read a saved [lat, lon] pair, or null when it is missing or malformed. */
export function parseStoredLocation(raw: string | null): LatLon | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (
      Array.isArray(value) &&
      value.length === 2 &&
      value.every((n) => typeof n === "number" && Number.isFinite(n)) &&
      Math.abs(value[0]) <= 90 &&
      Math.abs(value[1]) <= 180
    ) {
      return [value[0], value[1]];
    }
  } catch {
    // Fall through to null for text that is not JSON.
  }
  return null;
}

/** The saved location, or downtown Oakland when nothing usable is saved. */
export function initialLocation(storage: Pick<Storage, "getItem"> | null = safeStorage()): LatLon {
  try {
    return parseStoredLocation(storage?.getItem(LOCATION_STORAGE_KEY) ?? null) ?? DEFAULT_LOCATION;
  } catch {
    return DEFAULT_LOCATION;
  }
}

export function saveLocation(location: LatLon, storage: Pick<Storage, "setItem"> | null = safeStorage()): void {
  try {
    storage?.setItem(LOCATION_STORAGE_KEY, JSON.stringify(location));
  } catch {
    // Private windows can refuse storage. The map still works without it.
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export interface RouteRequest {
  destination: string;
  source: string;
  destinationCoords: LatLon | null;
  sourceCoords: LatLon | null;
  userLocation: LatLon | null;
}

/**
 * Build the /safe_path query, or null when there is not enough to ask for a
 * route. A typed starting point wins over the user's own location, which is
 * only the fallback when the starting point is left empty.
 */
export function routeQuery(req: RouteRequest): URLSearchParams | null {
  const destination = req.destination.trim();
  const source = req.source.trim();
  if (!destination || (!source && !req.userLocation)) return null;

  const params = new URLSearchParams({ destination });
  if (req.destinationCoords) {
    params.set("end_lat", String(req.destinationCoords[0]));
    params.set("end_lon", String(req.destinationCoords[1]));
  }
  if (req.sourceCoords) {
    params.set("start_lat", String(req.sourceCoords[0]));
    params.set("start_lon", String(req.sourceCoords[1]));
  } else if (source) {
    params.set("source", source);
  } else if (req.userLocation) {
    params.set("start_lat", String(req.userLocation[0]));
    params.set("start_lon", String(req.userLocation[1]));
  }
  return params;
}
