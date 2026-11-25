import { describe, expect, it } from "vitest";
import { MAP_MAX_ZOOM, MAP_STYLE_KEY, minimalAvailable, readMapStyle, saveMapStyle, tileSource } from "./tiles";

describe("tileSource", () => {
  it("uses the detailed OpenStreetMap map by default, which has business and building names", () => {
    for (const key of [undefined, "", "abc123"]) {
      const src = tileSource("light", "detailed", key);
      expect(src.url).toBe("https://tile.openstreetmap.org/{z}/{x}/{y}.png");
      expect(src.className).toBe("mono-tiles");
      expect(src.attribution).not.toContain("CARTO");
    }
  });

  it("uses CARTO Positron and Dark Matter for the minimal style when a key is set", () => {
    const light = tileSource("light", "minimal", "abc123");
    expect(light.url).toBe("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png?key=abc123");
    expect(light.subdomains).toBe("abcd");
    expect(light.attribution).toContain("CARTO");
    expect(light.className).toBeUndefined();
    expect(tileSource("dark", "minimal", "abc123").url).toContain("/dark_all/");
    expect(tileSource("light", "minimal", "a b&c").url).toContain("?key=a%20b%26c");
  });

  it("falls back to the detailed map when the minimal style has no key", () => {
    expect(tileSource("dark", "minimal", "  ").url).toContain("tile.openstreetmap.org");
    expect(minimalAvailable(undefined)).toBe(false);
    expect(minimalAvailable("abc")).toBe(true);
  });

  it("never lets the map zoom past what a source can enlarge, so it never goes blank", () => {
    for (const style of ["detailed", "minimal"] as const) {
      const src = tileSource("light", style, "abc");
      expect(src.maxNativeZoom).toBeLessThanOrEqual(MAP_MAX_ZOOM);
      expect(src.maxNativeZoom).toBeGreaterThanOrEqual(18);
    }
  });
});

describe("map style choice", () => {
  it("remembers the choice and defaults to detailed", () => {
    const data = new Map<string, string>();
    const storage = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
    expect(readMapStyle(storage)).toBe("detailed");
    saveMapStyle("minimal", storage);
    expect(data.get(MAP_STYLE_KEY)).toBe("minimal");
    expect(readMapStyle(storage)).toBe("minimal");
    expect(readMapStyle({ getItem: () => "garbage" })).toBe("detailed");
    expect(readMapStyle({ getItem: () => { throw new Error("blocked"); } })).toBe("detailed");
  });
});
