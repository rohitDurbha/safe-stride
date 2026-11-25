import * as maplibregl from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import "maplibre-gl/dist/maplibre-gl.css";
import type { LatLon } from "@/lib/mapSetup";
import type { ColorScheme } from "@/lib/theme";
import { cssColor } from "@/lib/theme";

maplibregl.setWorkerUrl(workerUrl);

export type MapInstance = maplibregl.Map;

/** The app's [lat, lon] pairs to MapLibre's [lon, lat]. */
export const toLngLat = ([lat, lon]: LatLon): [number, number] => [lon, lat];

/**
 * A GPU map with gestures tuned like a phone maps app: smooth fractional
 * zoom, inertia, and no rotation or tilt to get lost in.
 */
export function createMap(container: HTMLElement, center: LatLon, scheme: ColorScheme): MapInstance {
  const map = new maplibregl.Map({
    container,
    // A plain background until the real style arrives, in the right shade so nothing flashes.
    style: {
      version: 8,
      sources: {},
      layers: [{ id: "background", type: "background", paint: { "background-color": scheme === "dark" ? "#161616" : "#f2f2f2" } }],
    },
    center: toLngLat(center),
    zoom: 15,
    minZoom: 9,
    maxZoom: 19.5,
    dragRotate: false,
    pitchWithRotate: false,
    touchPitch: false,
    // Phones with 3x screens look the same at 2x and draw far fewer pixels.
    pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
    fadeDuration: 150,
    attributionControl: { compact: true },
  });
  map.touchZoomRotate.disableRotation();
  return map;
}

const ROUTE_SOURCE = "ss-route";
const ROUTE_LAYERS = ["ss-route-line", "ss-route-casing"];

/** Draw a route like Google Maps: a casing under a narrower line, a hollow start dot and an end pin. */
export function showRoute(map: MapInstance, points: LatLon[]): () => void {
  map.addSource(ROUTE_SOURCE, {
    type: "geojson",
    data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: points.map(toLngLat) } },
  });
  map.addLayer({
    id: "ss-route-casing",
    type: "line",
    source: ROUTE_SOURCE,
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": cssColor("--route-casing", "#ffffff"), "line-width": ["interpolate", ["linear"], ["zoom"], 12, 6, 17, 13] },
  });
  map.addLayer({
    id: "ss-route-line",
    type: "line",
    source: ROUTE_SOURCE,
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": cssColor("--route", "#111111"), "line-width": ["interpolate", ["linear"], ["zoom"], 12, 3, 17, 7] },
  });

  const markers = [
    new maplibregl.Marker({ element: pin("route-pin-start", 16), anchor: "center" }).setLngLat(toLngLat(points[0])),
    new maplibregl.Marker({ element: pin("route-pin-end", 30), anchor: "bottom", offset: [0, -4] }).setLngLat(toLngLat(points[points.length - 1])),
  ];
  markers.forEach((m) => m.addTo(map));

  return () => {
    markers.forEach((m) => m.remove());
    if (!map.getStyle()) return;
    for (const id of ROUTE_LAYERS) if (map.getLayer(id)) map.removeLayer(id);
    if (map.getSource(ROUTE_SOURCE)) map.removeSource(ROUTE_SOURCE);
  };
}

export function routeBounds(points: LatLon[]): [[number, number], [number, number]] {
  const lons = points.map((p) => p[1]);
  const lats = points.map((p) => p[0]);
  return [[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]];
}

function pin(className: string, size: number): HTMLElement {
  const outer = document.createElement("div");
  outer.className = "route-pin";
  outer.style.width = `${size}px`;
  outer.style.height = `${size}px`;
  const inner = document.createElement("div");
  inner.className = className;
  outer.appendChild(inner);
  return outer;
}

export function userMarker(map: MapInstance, position: LatLon): maplibregl.Marker {
  const el = document.createElement("div");
  el.className = "user-marker";
  el.innerHTML = '<div class="user-dot"></div>';
  el.setAttribute("aria-label", "Your location");
  return new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat(toLngLat(position)).addTo(map);
}

export { maplibregl };
