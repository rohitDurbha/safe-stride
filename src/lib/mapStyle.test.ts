import { describe, expect, it } from "vitest";
import {
  MAP_STYLE_KEY,
  StyleDocument,
  greyValue,
  loadMonochromeStyle,
  monochromeStyle,
  parseColor,
  rasterFallbackStyle,
  readMapStyle,
  saveMapStyle,
  toGrey,
} from "./mapStyle";

describe("parseColor", () => {
  it("reads the colour formats map styles use", () => {
    expect(parseColor("#fff")).toEqual([255, 255, 255, 1]);
    expect(parseColor("#f8f4f0")).toEqual([248, 244, 240, 1]);
    expect(parseColor("#00000080")?.[3]).toBeCloseTo(0.502, 2);
    expect(parseColor("rgb(10, 20, 30)")).toEqual([10, 20, 30, 1]);
    expect(parseColor("rgba(10,20,30,0.5)")).toEqual([10, 20, 30, 0.5]);
    expect(parseColor("hsl(0, 100%, 50%)")).toEqual([255, 0, 0, 1]);
    expect(parseColor("hsla(120, 100%, 25%, 0.4)")).toEqual([0, 128, 0, 0.4]);
    expect(parseColor("white")).toEqual([255, 255, 255, 1]);
  });

  it("leaves text that is not a colour alone", () => {
    for (const v of ["park", "{name}", "get", "Noto Sans Regular", "#zzz", "rgb(1,2)"]) {
      expect(parseColor(v)).toBeNull();
    }
  });
});

describe("toGrey", () => {
  it("keeps brightness in light mode and flips it in dark mode", () => {
    expect(toGrey("#ffffff", "light")).toBe("rgb(255, 255, 255)");
    expect(toGrey("#000000", "light")).toBe("rgb(0, 0, 0)");
    expect(toGrey("#ffffff", "dark")).toBe("rgb(22, 22, 22)");
    expect(toGrey("#000000", "dark")).toBe("rgb(231, 231, 231)");
    expect(toGrey("rgba(255,0,0,0.5)", "light")).toBe("rgba(54, 54, 54, 0.5)");
  });

  it("turns any hue into an equal red, green and blue", () => {
    const grey = toGrey("hsl(200, 80%, 60%)", "light")!;
    const [r, g, b] = grey.match(/\d+/g)!.map(Number);
    expect(r).toBe(g);
    expect(g).toBe(b);
  });
});

describe("greyValue", () => {
  it("recolours colours inside expressions and keeps everything else", () => {
    const expr = ["match", ["get", "class"], "park", "#d8e8c8", "water", "hsl(205, 56%, 73%)", "#fff"];
    const out = greyValue(expr, "light") as unknown[];
    expect(out[0]).toBe("match");
    expect(out[1]).toEqual(["get", "class"]);
    expect(out[2]).toBe("park");
    expect(out[3]).toMatch(/^rgb\((\d+), \1, \1\)$/);
    expect(out[5]).toMatch(/^rgb\((\d+), \1, \1\)$/);
    expect(out[6]).toBe("rgb(255, 255, 255)");
    expect(greyValue({ stops: [[10, "#f00"], [14, "#00f"]] }, "light")).toEqual({
      stops: [[10, "rgb(54, 54, 54)"], [14, "rgb(18, 18, 18)"]],
    });
  });
});

describe("monochromeStyle", () => {
  const style: StyleDocument = {
    version: 8,
    sources: { openmaptiles: { type: "vector" } },
    layers: [
      { id: "background", type: "background", paint: { "background-color": "#f8f4f0" } },
      { id: "poi_r1", type: "symbol", source: "openmaptiles", "source-layer": "poi",
        layout: { "icon-image": "{class}_11", "text-field": "{name}", "text-anchor": "top" },
        paint: { "text-color": "#666", "text-halo-color": "#ffffff" } },
      { id: "road_shield", type: "symbol", source: "openmaptiles", "source-layer": "transportation_name",
        layout: { "icon-image": "road_{ref_length}" } },
    ],
  };

  it("greys every paint colour and keeps the source data", () => {
    const out = monochromeStyle(style, "dark");
    expect(out.sources).toBe(style.sources);
    expect(out.layers[0].paint!["background-color"]).toMatch(/^rgb\((\d+), \1, \1\)$/);
    expect(out.layers[1].paint!["text-halo-color"]).toBe("rgb(22, 22, 22)");
  });

  it("drops coloured POI icons but keeps their names", () => {
    const out = monochromeStyle(style, "light");
    expect(out.layers[1].layout).toEqual({ "text-field": "{name}", "text-anchor": "top" });
    expect(out.layers[2].layout!["icon-image"]).toBe("road_{ref_length}");
    expect(style.layers[1].layout!["icon-image"]).toBe("{class}_11");
  });
});

describe("loadMonochromeStyle", () => {
  it("falls back to grey raster tiles when the style cannot be fetched", async () => {
    const failing = (async () => new Response("down", { status: 503 })) as unknown as typeof fetch;
    const out = await loadMonochromeStyle("minimal", "dark", failing);
    expect(out).toEqual(rasterFallbackStyle("dark"));
    const raster = out.layers.find((l) => l.type === "raster")!;
    expect(raster.paint!["raster-saturation"]).toBe(-1);
    expect(raster.paint!["raster-brightness-min"]).toBeGreaterThan(raster.paint!["raster-brightness-max"] as number);
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
    expect(readMapStyle({ getItem: () => { throw new Error("blocked"); } })).toBe("detailed");
  });
});
