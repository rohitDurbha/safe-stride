import type { ColorScheme } from "@/lib/theme";

/**
 * detailed: OpenStreetMap's standard map with shop, business and building
 *   names and house numbers, greyed (or inverted in dark mode) by index.css.
 * minimal: CARTO Positron and Dark Matter, which leave out business names on
 *   purpose. Needs a CARTO key, so without one it falls back to detailed.
 */
export type MapStyle = "detailed" | "minimal";

export interface TileSource {
  url: string;
  attribution: string;
  subdomains?: string;
  /** The deepest zoom the server has tiles for. Leaflet enlarges these past it. */
  maxNativeZoom: number;
  /** A CSS class for the tile layer. OpenStreetMap tiles are greyed by index.css. */
  className?: string;
}

/** How far the map lets you zoom in. Past a source's own limit its tiles are enlarged instead of going blank. */
export const MAP_MAX_ZOOM = 20;

const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const CARTO_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, &copy; <a href="https://carto.com/attribution/">CARTO</a>';

// Positron for light mode and Dark Matter for dark mode. Both are already monochrome.
const CARTO_STYLES: Record<ColorScheme, string> = { light: "light_all", dark: "dark_all" };

export function tileSource(scheme: ColorScheme, style: MapStyle, cartoKey: string | undefined): TileSource {
  const key = (cartoKey ?? "").trim();
  if (style === "minimal" && key) {
    return {
      url: `https://{s}.basemaps.cartocdn.com/${CARTO_STYLES[scheme]}/{z}/{x}/{y}{r}.png?key=${encodeURIComponent(key)}`,
      attribution: CARTO_ATTRIBUTION,
      subdomains: "abcd",
      maxNativeZoom: 18,
    };
  }
  return {
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: OSM_ATTRIBUTION,
    maxNativeZoom: 19,
    className: "mono-tiles",
  };
}

/** Whether the minimal style can be offered at all. */
export function minimalAvailable(cartoKey: string | undefined): boolean {
  return !!(cartoKey ?? "").trim();
}

export const MAP_STYLE_KEY = "safeStride_mapStyle";

export function readMapStyle(storage: Pick<Storage, "getItem"> | null = safeStorage()): MapStyle {
  try {
    return storage?.getItem(MAP_STYLE_KEY) === "minimal" ? "minimal" : "detailed";
  } catch {
    return "detailed";
  }
}

export function saveMapStyle(style: MapStyle, storage: Pick<Storage, "setItem"> | null = safeStorage()): void {
  try {
    storage?.setItem(MAP_STYLE_KEY, style);
  } catch {
    // The choice just won't be remembered.
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export const CARTO_API_KEY: string | undefined = import.meta.env.VITE_CARTO_API_KEY;
