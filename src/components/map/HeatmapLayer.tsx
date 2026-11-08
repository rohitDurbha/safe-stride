import React, { useRef, useEffect } from 'react';
import L from 'leaflet';
import { toast } from '@/components/ui/use-toast';

interface HeatmapLayerProps {
  centerCoords: [number, number];
  map: L.Map;
}

const BASE_URL = "http://127.0.0.1:5000";

interface HeatmapPoint {
  geometry?: { coordinates?: [number, number] };
  properties?: { intensity?: number; type?: string };
}

const getColor = (value: number): string => {
  if (value > 0.7) return '#d73027';
  if (value > 0.4) return '#fc8d59';
  if (value > 0.2) return '#fee090';
  return '#e0f3f8';
};

const HeatmapLayer = ({ centerCoords, map }: HeatmapLayerProps) => {
  const heatmapLayerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    let cleanupRequest = () => {};

    // Safety check to ensure map exists and is valid
    if (!map || !map._loaded) {
      console.error("Map is not properly initialized in HeatmapLayer");
      return;
    }

    try {
      // Clean up previous layer if it exists
      if (heatmapLayerRef.current) {
        if (map.hasLayer(heatmapLayerRef.current)) {
          map.removeLayer(heatmapLayerRef.current);
        }
      }

      // Create a new layer group
      const heatmapOverlay = L.layerGroup();
      heatmapLayerRef.current = heatmapOverlay;

      // Ignore a response that arrives after the heatmap was switched off
      let cancelled = false;
      const timer = setTimeout(() => {
        fetch(`${BASE_URL}/heatmap_data`)
          .then(res => {
            if (!res.ok) {
              throw new Error(`heatmap_data returned HTTP ${res.status}`);
            }
            return res.json();
          })
          .then((points: HeatmapPoint[]) => {
            if (cancelled || !Array.isArray(points)) return;

            points.forEach(point => {
              const [lon, lat] = point.geometry?.coordinates ?? [];
              if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
              const intensity = Number(point.properties?.intensity) || 0;

              const marker = L.circleMarker([lat, lon], {
                radius: 8 + (intensity * 12),
                fillColor: getColor(intensity),
                color: 'rgba(0,0,0,0.1)',
                weight: 1,
                opacity: 0.8,
                fillOpacity: 0.6
              });

              marker.bindPopup(`Reported ${point.properties?.type ?? 'incident'}`);
              heatmapOverlay.addLayer(marker);
            });

            heatmapOverlay.addTo(map);
          })
          .catch(error => {
            if (cancelled) return;
            console.error("Error fetching heatmap data:", error);
            toast({
              variant: "destructive",
              title: "Heatmap unavailable",
              description: "Could not load incident hotspots from the server.",
            });
          });
      }, 500);

      cleanupRequest = () => {
        cancelled = true;
        clearTimeout(timer);
      };
    } catch (error) {
      console.error("Error in HeatmapLayer:", error);
    }

    return () => {
      cleanupRequest();
      // Safety cleanup
      try {
        if (heatmapLayerRef.current && map && map.hasLayer && typeof map.hasLayer === 'function') {
          if (map.hasLayer(heatmapLayerRef.current)) {
            map.removeLayer(heatmapLayerRef.current);
          }
          heatmapLayerRef.current = null;
        }
      } catch (err) {
        console.error("Error during HeatmapLayer cleanup:", err);
      }
    };
  }, [centerCoords, map]);

  return null;
};

export default HeatmapLayer;
