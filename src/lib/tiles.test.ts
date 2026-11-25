import { describe, expect, it } from "vitest";
import { tileSource } from "./tiles";

describe("tileSource", () => {
  it("uses CARTO Positron and Dark Matter with the key when one is set", () => {
    const light = tileSource("light", "abc123");
    expect(light.url).toBe("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png?key=abc123");
    expect(light.subdomains).toBe("abcd");
    expect(light.attribution).toContain("CARTO");
    expect(light.attribution).toContain("OpenStreetMap");
    expect(light.className).toBeUndefined();
    expect(tileSource("dark", "abc123").url).toContain("/dark_all/");
  });

  it("escapes the key", () => {
    expect(tileSource("light", "a b&c").url).toContain("?key=a%20b%26c");
  });

  it("falls back to greyed OpenStreetMap tiles without a key", () => {
    for (const key of [undefined, "", "   "]) {
      const src = tileSource("dark", key);
      expect(src.url).toBe("https://tile.openstreetmap.org/{z}/{x}/{y}.png");
      expect(src.className).toBe("mono-tiles");
      expect(src.attribution).not.toContain("CARTO");
    }
  });
});
