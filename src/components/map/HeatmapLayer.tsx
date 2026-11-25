import { useEffect } from 'react';
import L from 'leaflet';
import { toast } from '@/components/ui/use-toast';
import { apiUrl } from '@/lib/api';
import { cssColor, type ColorScheme } from '@/lib/theme';

interface HeatmapLayerProps {
  map: L.Map;
  scheme: ColorScheme;
}

interface HeatmapPoint {
  geometry?: { coordinates?: [number, number] };
  properties?: { intensity?: number; type?: string };
}

function readableType(type: string | undefined): string {
  if (!type) return 'Reported incident';
  const lower = type.replace(/_/g, ' ').toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/**
 * Incident hotspots as soft monochrome circles. Darker and larger means more
 * reported incidents nearby. The points are fetched once per map.
 */
const HeatmapLayer = ({ map, scheme }: HeatmapLayerProps) => {
  useEffect(() => {
    const group = L.layerGroup().addTo(map);
    const controller = new AbortController();
    const ink = cssColor('--heat', scheme === 'dark' ? '#ffffff' : '#111111');

    fetch(apiUrl('/heatmap_data'), { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`heatmap_data returned HTTP ${res.status}`);
        return res.json();
      })
      .then((points: HeatmapPoint[]) => {
        if (!Array.isArray(points)) return;
        points.forEach((point) => {
          const [lon, lat] = point.geometry?.coordinates ?? [];
          if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
          const intensity = Math.min(1, Math.max(0, Number(point.properties?.intensity) || 0));
          L.circleMarker([lat, lon], {
            radius: 10 + intensity * 16,
            stroke: false,
            fillColor: ink,
            fillOpacity: 0.08 + intensity * 0.22,
          })
            .bindPopup(readableType(point.properties?.type))
            .addTo(group);
        });
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        console.error('Error fetching heatmap data:', error);
        toast({
          variant: 'destructive',
          title: 'Heatmap unavailable',
          description: 'Could not load incident hotspots right now.',
        });
      });

    return () => {
      controller.abort();
      group.remove();
    };
  }, [map, scheme]);

  return null;
};

export default HeatmapLayer;
