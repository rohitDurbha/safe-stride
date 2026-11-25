import { describe, expect, it } from "vitest";
import { createPlaceSearch, parsePlaces, placeSearchUrl } from "./places";

const reply = [
  { display_name: "Lake Merritt, Oakland", lat: "37.80", lon: "-122.25" },
  { display_name: "Broken", lat: "north", lon: "-122.25" },
  { lat: "37.8", lon: "-122.2" },
];

function fakeFetch(calls: { url: string; init?: RequestInit }[], body: unknown = reply, status = 200) {
  return (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
}

describe("parsePlaces", () => {
  it("keeps named places with numeric coordinates", () => {
    expect(parsePlaces(reply)).toEqual([{ name: "Lake Merritt, Oakland", coords: [37.8, -122.25] }]);
    expect(parsePlaces({ error: "x" })).toEqual([]);
    expect(parsePlaces(null)).toEqual([]);
  });

  it("returns at most five places", () => {
    const many = Array.from({ length: 9 }, (_, i) => ({ display_name: `P${i}`, lat: "37.8", lon: "-122.2" }));
    expect(parsePlaces(many)).toHaveLength(5);
  });
});

describe("placeSearchUrl", () => {
  it("limits the search to Oakland", () => {
    const url = new URL(placeSearchUrl("lake merritt"));
    expect(url.searchParams.get("q")).toBe("lake merritt");
    expect(url.searchParams.get("bounded")).toBe("1");
    expect(url.searchParams.get("viewbox")).toBe("-122.35,37.90,-122.15,37.70");
  });
});

describe("createPlaceSearch", () => {
  function fakeClock() {
    const clock = { t: 0, slept: [] as number[] };
    return {
      clock,
      now: () => clock.t,
      sleep: async (ms: number) => {
        // Record the wait without moving time, as if every call started at once.
        clock.slept.push(ms);
      },
    };
  }

  it("skips short queries without a request", async () => {
    const calls: { url: string }[] = [];
    const search = createPlaceSearch(fakeFetch(calls));
    expect(await search("  la ")).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  it("sends no custom User-Agent header", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const t = fakeClock();
    await createPlaceSearch(fakeFetch(calls), 1000, t)("Lake Merritt");
    expect(calls[0].init?.headers).toEqual({ "Accept-Language": "en" });
  });

  it("spaces requests at least a second apart", async () => {
    const calls: { url: string }[] = [];
    const t = fakeClock();
    const search = createPlaceSearch(fakeFetch(calls), 1000, t);
    await Promise.all([search("aaa"), search("bbb"), search("ccc")]);
    expect(calls).toHaveLength(3);
    expect(t.clock.slept).toEqual([1000, 2000]);

    t.clock.t += 5000;
    await search("ddd");
    expect(t.clock.slept).toEqual([1000, 2000]);
  });

  it("throws on an error reply", async () => {
    const search = createPlaceSearch(fakeFetch([], {}, 429), 1000, fakeClock());
    await expect(search("Lake Merritt")).rejects.toThrow("429");
  });
});
