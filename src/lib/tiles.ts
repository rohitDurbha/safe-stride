import type { ColorScheme } from "@/lib/theme";

export interface TileSource {
  url: string;
  attribution: string;
  subdomains?: string;
  maxZoom: number;
  /** A CSS class for the tile layer. The OpenStreetMap fallback is greyed by index.css. */
  className?: string;
}

const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const CARTO_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, &copy; <a href="https://carto.com/attribution/">CARTO</a>';

// Positron for light mode and Dark Matter for dark mode. Both are already monochrome.
const CARTO_STYLES: Record<ColorScheme, string> = { light: "light_all", dark: "dark_all" };

/**
 * CARTO's grey basemaps when a key is configured, otherwise the keyless
 * OpenStreetMap tiles. CARTO stopped serving raster tiles without a key on
 * 25 September 2026 and shows an "API key required" image instead.
 */
export function tileSource(scheme: ColorScheme, cartoKey: string | undefined): TileSource {
  const key = (cartoKey ?? "").trim();
  if (key) {
    return {
      url: `https://{s}.basemaps.cartocdn.com/${CARTO_STYLES[scheme]}/{z}/{x}/{y}{r}.png?key=${encodeURIComponent(key)}`,
      attribution: CARTO_ATTRIBUTION,
      subdomains: "abcd",
      maxZoom: 20,
    };
  }
  return {
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: OSM_ATTRIBUTION,
    maxZoom: 19,
    className: "mono-tiles",
  };
}

export const CARTO_API_KEY: string | undefined = import.meta.env.VITE_CARTO_API_KEY;
