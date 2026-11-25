/**
 * Turns an OpenFreeMap vector style into SafeStride's monochrome map.
 *
 * Every colour in the style, including colours inside expressions, becomes a
 * grey of the same brightness. Dark mode flips the brightness so land turns
 * near black and roads and labels turn light. Coloured POI icons are dropped
 * and their names kept, because the sprite images cannot be recoloured.
 */
import type { ColorScheme } from "@/lib/theme";

export type MapStyle = "detailed" | "minimal";

// OpenFreeMap: free, no key, no request limits, commercial use allowed.
export const STYLE_URLS: Record<MapStyle, string> = {
  detailed: "https://tiles.openfreemap.org/styles/liberty",
  minimal: "https://tiles.openfreemap.org/styles/positron",
};

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

export interface StyleLayer {
  id: string;
  type: string;
  source?: string;
  "source-layer"?: string;
  paint?: Record<string, Json>;
  layout?: Record<string, Json>;
  [key: string]: unknown;
}

export interface StyleDocument {
  version: number;
  sources: Record<string, unknown>;
  layers: StyleLayer[];
  [key: string]: unknown;
}

const NAMED: Record<string, [number, number, number, number]> = {
  white: [255, 255, 255, 1],
  black: [0, 0, 0, 1],
};

/** Parse a CSS colour string into [r, g, b, a], or null when it is not a colour. */
export function parseColor(value: string): [number, number, number, number] | null {
  const v = value.trim().toLowerCase();
  if (NAMED[v]) return NAMED[v];
  let m = /^#([0-9a-f]{3,8})$/.exec(v);
  if (m) {
    const hex = m[1];
    if (hex.length === 3 || hex.length === 4) {
      const [r, g, b, a = "f"] = hex.split("");
      return [parseInt(r + r, 16), parseInt(g + g, 16), parseInt(b + b, 16), parseInt(a + a, 16) / 255];
    }
    if (hex.length === 6 || hex.length === 8) {
      const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
      return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16), a];
    }
    return null;
  }
  m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/.exec(v);
  if (m) {
    return [Number(m[1]), Number(m[2]), Number(m[3]), alpha(m[4])];
  }
  m = /^hsla?\(\s*([\d.-]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%(?:[\s,/]+([\d.]+%?))?\s*\)$/.exec(v);
  if (m) {
    const [r, g, b] = hslToRgb(Number(m[1]), Number(m[2]) / 100, Number(m[3]) / 100);
    return [r, g, b, alpha(m[4])];
  }
  return null;
}

function alpha(raw: string | undefined): number {
  if (raw === undefined) return 1;
  return raw.endsWith("%") ? Number(raw.slice(0, -1)) / 100 : Number(raw);
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

/** The grey with the same perceived brightness, flipped for dark mode. */
export function toGrey(value: string, scheme: ColorScheme): string | null {
  const c = parseColor(value);
  if (!c) return null;
  const [r, g, b, a] = c;
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  // Light mode keeps the brightness. Dark mode inverts it into a soft range so
  // land is near black (not pure black) and the brightest text is off white.
  const grey = scheme === "light" ? luminance : 22 + (255 - luminance) * 0.82;
  const v = Math.max(0, Math.min(255, Math.round(grey)));
  const alphaOut = Math.round(a * 1000) / 1000;
  return alphaOut >= 1 ? `rgb(${v}, ${v}, ${v})` : `rgba(${v}, ${v}, ${v}, ${alphaOut})`;
}

/** Recolour every colour string inside a paint value, including inside expressions. */
export function greyValue(value: Json, scheme: ColorScheme): Json {
  if (typeof value === "string") return toGrey(value, scheme) ?? value;
  if (Array.isArray(value)) return value.map((v) => greyValue(v, scheme));
  if (value && typeof value === "object") {
    const out: { [key: string]: Json } = {};
    for (const [k, v] of Object.entries(value)) out[k] = greyValue(v, scheme);
    return out;
  }
  return value;
}

const isPoiIconLayer = (layer: StyleLayer) =>
  layer.type === "symbol" && layer["source-layer"] === "poi" && layer.layout?.["icon-image"] !== undefined;

export function monochromeStyle(style: StyleDocument, scheme: ColorScheme): StyleDocument {
  const layers = style.layers.map((layer) => {
    const next: StyleLayer = { ...layer };
    if (layer.paint) {
      const paint: Record<string, Json> = {};
      for (const [k, v] of Object.entries(layer.paint)) paint[k] = greyValue(v, scheme);
      // Satellite or hillshade rasters, if a style has any, lose their colour too.
      if (layer.type === "raster") paint["raster-saturation"] = -1;
      next.paint = paint;
    }
    if (isPoiIconLayer(layer)) {
      const layout = { ...layer.layout };
      delete layout["icon-image"];
      next.layout = layout;
    }
    return next;
  });
  return { ...style, layers };
}

/**
 * Used when the vector style cannot be loaded: the standard OpenStreetMap
 * raster tiles, made grey (and inverted for dark mode) on the GPU.
 */
export function rasterFallbackStyle(scheme: ColorScheme): StyleDocument {
  const dark = scheme === "dark";
  return {
    version: 8,
    sources: {
      osm: {
        type: "raster",
        tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
        tileSize: 256,
        maxzoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      },
    },
    layers: [
      { id: "background", type: "background", paint: { "background-color": dark ? "rgb(22, 22, 22)" : "rgb(242, 242, 242)" } },
      {
        id: "osm",
        type: "raster",
        source: "osm",
        paint: {
          "raster-saturation": -1,
          // Swapping min and max brightness inverts the tiles for dark mode.
          "raster-brightness-min": dark ? 0.92 : 0,
          "raster-brightness-max": dark ? 0.08 : 1,
          "raster-contrast": dark ? -0.1 : 0.05,
        },
      },
    ],
  };
}

const styleCache = new Map<string, Promise<StyleDocument>>();

/** Fetch a style once per session and return it in the app's monochrome colours. */
export async function loadMonochromeStyle(
  mapStyle: MapStyle,
  scheme: ColorScheme,
  fetcher: typeof fetch = (i, o) => fetch(i, o),
): Promise<StyleDocument> {
  const url = STYLE_URLS[mapStyle];
  let pending = styleCache.get(url);
  if (!pending) {
    pending = fetcher(url).then((res) => {
      if (!res.ok) throw new Error(`Map style answered ${res.status}`);
      return res.json() as Promise<StyleDocument>;
    });
    styleCache.set(url, pending);
    pending.catch(() => styleCache.delete(url));
  }
  try {
    return monochromeStyle(await pending, scheme);
  } catch (err) {
    console.warn("Vector map style unavailable, using raster tiles", err);
    return rasterFallbackStyle(scheme);
  }
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
