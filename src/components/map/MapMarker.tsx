import { useEffect, useRef } from 'react';
import type { Marker } from 'maplibre-gl';
import { MapInstance, toLngLat, userMarker } from './mapLayers';

interface MapMarkerProps {
  position: [number, number];
  map: MapInstance;
}

/** The breathing dot that marks where the user is. It moves instead of being recreated. */
const MapMarker = ({ position, map }: MapMarkerProps) => {
  const markerRef = useRef<Marker | null>(null);

  useEffect(() => {
    const marker = userMarker(map, position);
    markerRef.current = marker;
    return () => {
      marker.remove();
      markerRef.current = null;
    };
    // The marker is created once per map. Position changes move it below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  useEffect(() => {
    markerRef.current?.setLngLat(toLngLat(position));
  }, [position]);

  return null;
};

export default MapMarker;
