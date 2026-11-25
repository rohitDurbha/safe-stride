import L from "leaflet";
import type { LatLon } from "@/lib/mapSetup";
import { cssColor, type ColorScheme } from "@/lib/theme";
import { CARTO_API_KEY, MAP_MAX_ZOOM, type MapStyle, tileSource } from "@/lib/tiles";

export function createMap(element: HTMLElement, center: LatLon): L.Map {
  const map = L.map(element, {
    zoomControl: false,
    attributionControl: true,
    doubleClickZoom: true,
    scrollWheelZoom: true,
    zoomSnap: 0.5,
    maxZoom: MAP_MAX_ZOOM,
    tap: false,
  } as L.MapOptions).setView(center, 15);
  map.attributionControl.setPrefix(false);
  return map;
}

export function createTiles(scheme: ColorScheme, style: MapStyle): L.TileLayer {
  const source = tileSource(scheme, style, CARTO_API_KEY);
  return L.tileLayer(source.url, {
    attribution: source.attribution,
    subdomains: source.subdomains ?? "abc",
    maxNativeZoom: source.maxNativeZoom,
    maxZoom: MAP_MAX_ZOOM,
    className: source.className,
  });
}

export const userIcon = () =>
  L.divIcon({ className: "user-marker", html: '<div class="user-dot"></div>', iconSize: [18, 18], iconAnchor: [9, 9] });

const startIcon = () =>
  L.divIcon({ className: "route-pin", html: '<div class="route-pin-start"></div>', iconSize: [16, 16], iconAnchor: [8, 8] });

const endIcon = () =>
  L.divIcon({ className: "route-pin", html: '<div class="route-pin-end"></div>', iconSize: [30, 30], iconAnchor: [15, 36] });

/**
 * Draw a route the way Google Maps does: a wide casing under a narrower line,
 * a hollow start dot and a filled end pin. Colours come from the theme.
 */
export function routeLayer(points: LatLon[]): L.LayerGroup {
  const casing = L.polyline(points, {
    color: cssColor("--route-casing", "#ffffff"),
    weight: 11,
    opacity: 1,
    lineCap: "round",
    lineJoin: "round",
    interactive: false,
  });
  const line = L.polyline(points, {
    color: cssColor("--route", "#111111"),
    weight: 6,
    opacity: 1,
    lineCap: "round",
    lineJoin: "round",
    interactive: false,
  });
  return L.layerGroup([
    casing,
    line,
    L.marker(points[0], { icon: startIcon(), keyboard: false, title: "Start" }),
    L.marker(points[points.length - 1], { icon: endIcon(), keyboard: false, title: "Destination" }),
  ]);
}

export function routeBounds(points: LatLon[]): L.LatLngBounds {
  return L.latLngBounds(points.map(([lat, lon]) => L.latLng(lat, lon)));
}
