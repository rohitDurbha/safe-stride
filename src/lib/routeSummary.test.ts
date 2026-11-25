import { describe, expect, it } from "vitest";
import { formatDistance, formatDuration, routeStats, walkingMinutes } from "./routeSummary";

describe("formatting", () => {
  it("rounds walking time to whole minutes and never shows zero", () => {
    expect(walkingMinutes(0)).toBe(1);
    expect(walkingMinutes(1395)).toBe(17);
  });

  it("formats durations and distances like a maps app", () => {
    expect(formatDuration(17)).toBe("17 min");
    expect(formatDuration(60)).toBe("1 hr");
    expect(formatDuration(75)).toBe("1 hr 15 min");
    expect(formatDistance(234)).toBe("230 m");
    expect(formatDistance(1395)).toBe("1.4 km");
  });
});

describe("routeStats", () => {
  it("compares the safer route with the shortest one", () => {
    expect(routeStats({ distance_m: 1395, shortest_distance_m: 1315, exposure_reduction: 0.34, period: "day" })).toEqual({
      duration: "17 min",
      distance: "1.4 km",
      saferBy: 34,
      extraMinutes: 1,
      shortestDuration: "16 min",
      night: false,
    });
  });

  it("handles a missing reduction and a night route", () => {
    const stats = routeStats({ distance_m: 500, shortest_distance_m: 0, period: "night" });
    expect(stats.saferBy).toBe(0);
    expect(stats.extraMinutes).toBe(0);
    expect(stats.night).toBe(true);
  });
});
