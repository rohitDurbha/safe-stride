/** What /safe_path returns next to the route points. */
export interface RouteSummary {
  distance_m: number;
  shortest_distance_m: number;
  exposure_reduction?: number;
  period: "day" | "night" | string;
}

/** Average walking speed used for time estimates, about 4.8 km/h. */
export const WALKING_SPEED_M_PER_S = 1.33;

export function walkingMinutes(meters: number): number {
  return Math.max(1, Math.round(meters / WALKING_SPEED_M_PER_S / 60));
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters / 10) * 10} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export interface RouteStats {
  duration: string;
  distance: string;
  /** Whole percent of reported crime avoided compared with the shortest path. */
  saferBy: number;
  /** Extra walking time compared with the shortest path, in minutes. */
  extraMinutes: number;
  shortestDuration: string;
  night: boolean;
}

export function routeStats(summary: RouteSummary): RouteStats {
  const minutes = walkingMinutes(summary.distance_m);
  const shortest = walkingMinutes(summary.shortest_distance_m || summary.distance_m);
  return {
    duration: formatDuration(minutes),
    distance: formatDistance(summary.distance_m),
    saferBy: Math.max(0, Math.round((summary.exposure_reduction ?? 0) * 100)),
    extraMinutes: Math.max(0, minutes - shortest),
    shortestDuration: formatDuration(shortest),
    night: summary.period === "night",
  };
}
