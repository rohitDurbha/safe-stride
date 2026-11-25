import { useEffect } from 'react';
import { toast } from '@/components/ui/use-toast';
import { apiUrl } from '@/lib/api';
import type { ColorScheme } from '@/lib/theme';
import { MapInstance, maplibregl } from './mapLayers';

interface HeatmapLayerProps {
  map: MapInstance;
  scheme: ColorScheme;
  /** Bumped whenever the base style reloads, which removes added layers. */
  styleRevision: number;
}

const SOURCE = 'ss-heat';
const LAYERS = ['ss-heat-points', 'ss-heat'];

function readableType(type: unknown): string {
  if (typeof type !== 'string' || !type) return 'Reported incident';
  const lower = type.replace(/_/g, ' ').toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/**
 * Incident hotspots drawn by the GPU: a soft monochrome heatmap when zoomed
 * out that turns into tappable dots when zoomed in.
 */
const HeatmapLayer = ({ map, scheme, styleRevision }: HeatmapLayerProps) => {
  useEffect(() => {
    const controller = new AbortController();
    const shade = (a: number) => (scheme === 'dark' ? `rgba(255,255,255,${a})` : `rgba(17,17,17,${a})`);

    const onClick = (e: maplibregl.MapLayerMouseEvent) => {
      const feature = e.features?.[0];
      if (!feature) return;
      new maplibregl.Popup({ closeButton: false, offset: 10 })
        .setLngLat(e.lngLat)
        .setText(readableType(feature.properties?.type))
        .addTo(map);
    };

    fetch(apiUrl('/heatmap_data'), { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`heatmap_data returned HTTP ${res.status}`);
        return res.json();
      })
      .then((features) => {
        if (controller.signal.aborted || !Array.isArray(features) || !map.getStyle()) return;
        map.addSource(SOURCE, { type: 'geojson', data: { type: 'FeatureCollection', features } });
        const firstLabel = map.getStyle().layers.find((l) => l.type === 'symbol')?.id;
        map.addLayer({
          id: 'ss-heat',
          type: 'heatmap',
          source: SOURCE,
          maxzoom: 17,
          paint: {
            'heatmap-weight': ['interpolate', ['linear'], ['coalesce', ['get', 'intensity'], 0.5], 0, 0.2, 1, 1],
            'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 11, 0.8, 16, 2],
            'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 11, 14, 16, 40],
            'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 15, 0.85, 17, 0],
            'heatmap-color': [
              'interpolate', ['linear'], ['heatmap-density'],
              0, shade(0), 0.2, shade(0.12), 0.5, shade(0.28), 0.8, shade(0.45), 1, shade(0.6),
            ],
          },
        }, firstLabel);
        map.addLayer({
          id: 'ss-heat-points',
          type: 'circle',
          source: SOURCE,
          minzoom: 15,
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 15, 4, 18, 9],
            'circle-color': shade(0.7),
            'circle-stroke-color': scheme === 'dark' ? '#161616' : '#ffffff',
            'circle-stroke-width': 1.5,
            'circle-opacity': ['interpolate', ['linear'], ['zoom'], 15, 0, 16, 1],
            'circle-stroke-opacity': ['interpolate', ['linear'], ['zoom'], 15, 0, 16, 1],
          },
        });
        map.on('click', 'ss-heat-points', onClick);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        console.error('Error fetching heatmap data:', error);
        toast({ variant: 'destructive', title: 'Heatmap unavailable', description: 'Could not load incident hotspots right now.' });
      });

    return () => {
      controller.abort();
      map.off('click', 'ss-heat-points', onClick);
      if (!map.getStyle()) return;
      for (const id of LAYERS) if (map.getLayer(id)) map.removeLayer(id);
      if (map.getSource(SOURCE)) map.removeSource(SOURCE);
    };
  }, [map, scheme, styleRevision]);

  return null;
};

export default HeatmapLayer;
