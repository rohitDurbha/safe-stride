import { useEffect } from 'react';
import L from 'leaflet';
import { userIcon } from './mapLayers';

interface MapMarkerProps {
  position: [number, number];
  map: L.Map;
}

/** The breathing dot that marks where the user is. */
const MapMarker = ({ position, map }: MapMarkerProps) => {
  useEffect(() => {
    const marker = L.marker(position, { icon: userIcon(), keyboard: false, zIndexOffset: 500, title: 'Your location' }).addTo(map);
    return () => {
      marker.remove();
    };
  }, [position, map]);

  return null;
};

export default MapMarker;
