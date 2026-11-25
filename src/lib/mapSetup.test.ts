import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOCATION,
  LOCATION_STORAGE_KEY,
  initialLocation,
  parseStoredLocation,
  routeQuery,
  saveLocation,
} from "./mapSetup";

describe("parseStoredLocation", () => {
  it("reads a saved latitude and longitude", () => {
    expect(parseStoredLocation("[37.81, -122.27]")).toEqual([37.81, -122.27]);
  });

  it.each([null, "", "nope", "{}", "[1]", "[1,2,3]", '["37","-122"]', "[95, 10]", "[10, 190]", "[null, 1]"])(
    "rejects %s",
    (raw) => {
      expect(parseStoredLocation(raw)).toBeNull();
    },
  );
});

describe("initialLocation", () => {
  it("uses the saved location when it is valid", () => {
    const storage = { getItem: (key: string) => (key === LOCATION_STORAGE_KEY ? "[37.8, -122.2]" : null) };
    expect(initialLocation(storage)).toEqual([37.8, -122.2]);
  });

  it("falls back to downtown Oakland", () => {
    expect(initialLocation({ getItem: () => "garbage" })).toEqual(DEFAULT_LOCATION);
    expect(initialLocation(null)).toEqual(DEFAULT_LOCATION);
    expect(initialLocation({ getItem: () => { throw new Error("blocked"); } })).toEqual(DEFAULT_LOCATION);
  });
});

describe("saveLocation", () => {
  it("writes JSON and ignores storage that refuses writes", () => {
    const saved: Record<string, string> = {};
    saveLocation([1, 2], { setItem: (k, v) => { saved[k] = v; } });
    expect(saved[LOCATION_STORAGE_KEY]).toBe("[1,2]");
    expect(() => saveLocation([1, 2], { setItem: () => { throw new Error("full"); } })).not.toThrow();
  });
});

describe("routeQuery", () => {
  const base = { destination: "", source: "", destinationCoords: null, sourceCoords: null, userLocation: null };

  it("needs a destination and some starting point", () => {
    expect(routeQuery(base)).toBeNull();
    expect(routeQuery({ ...base, destination: "  Lake Merritt " })).toBeNull();
    expect(routeQuery({ ...base, source: "Uptown" })).toBeNull();
  });

  it("prefers picked coordinates, then typed text, then the user's location", () => {
    const req = { ...base, destination: " Lake Merritt ", userLocation: [37.8, -122.27] as [number, number] };
    expect(Object.fromEntries(routeQuery(req)!)).toEqual({
      destination: "Lake Merritt", start_lat: "37.8", start_lon: "-122.27",
    });
    expect(Object.fromEntries(routeQuery({ ...req, source: " Uptown " })!)).toEqual({
      destination: "Lake Merritt", source: "Uptown",
    });
    expect(Object.fromEntries(routeQuery({
      ...req, source: "Uptown", sourceCoords: [37.81, -122.26], destinationCoords: [37.80, -122.25],
    })!)).toEqual({
      destination: "Lake Merritt", end_lat: "37.8", end_lon: "-122.25", start_lat: "37.81", start_lon: "-122.26",
    });
  });
});

describe("routeQuery period", () => {
  it("adds a forced period only when one is chosen", () => {
    const req = { destination: "Lake Merritt", source: "Uptown", destinationCoords: null, sourceCoords: null, userLocation: null };
    expect(routeQuery(req)!.has("period")).toBe(false);
    expect(routeQuery({ ...req, period: "night" })!.get("period")).toBe("night");
  });
});
