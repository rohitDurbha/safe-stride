import React, { useCallback, useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { AlertTriangle, Locate } from 'lucide-react';
import { Button } from '@/components/ui/button';
import DestinationInput from './map/DestinationInput';
import MapMarker from './map/MapMarker';
import HeatmapLayer from './map/HeatmapLayer';
import { toast } from '@/components/ui/use-toast';
import { apiUrl } from '@/lib/api';
import { LatLon, initialLocation, routeQuery, saveLocation } from '@/lib/mapSetup';

interface LeafletMapProps {
  showHeatmap?: boolean;
}

interface RouteSummary {
  period: string;
  distance_m: number;
  shortest_distance_m: number;
  exposure_reduction?: number;
}

/** Create the Leaflet map with OpenStreetMap tiles inside the given element. */
function createMap(element: HTMLElement, center: LatLon): L.Map {
  const map = L.map(element, {
    attributionControl: true,
    zoomControl: false,
    doubleClickZoom: true,
    scrollWheelZoom: true,
    dragging: true,
  }).setView(center, 14);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  }).addTo(map);
  L.control.zoom({ position: "topright" }).addTo(map);
  return map;
}

const LeafletMap: React.FC<LeafletMapProps> = ({ showHeatmap = false }) => {
  // The live Leaflet map. The ref is for event handlers and cleanup, and the
  // state copy makes the markers and heatmap render once the map exists.
  const mapInstanceRef = useRef<L.Map | null>(null);
  const [map, setMap] = useState<L.Map | null>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);

  const [userLocation, setUserLocation] = useState<LatLon>(() => initialLocation());
  // The map is built once with this centre. Later moves pan the existing map.
  const [startCenter] = useState<LatLon>(userLocation);
  const [mapError, setMapError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [isRouting, setIsRouting] = useState(false);

  const [destination, setDestination] = useState<string>("");
  const [source, setSource] = useState<string>("");
  const [sourceCoords, setSourceCoords] = useState<LatLon | null>(null);
  const [destinationCoords, setDestinationCoords] = useState<LatLon | null>(null);

  // React calls this with the container element when it mounts and with null
  // when it unmounts, so the map lives exactly as long as its container.
  const attachMap = useCallback((element: HTMLDivElement | null) => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
      routeLayerRef.current = null;
      setMap(null);
    }
    if (!element) return;
    try {
      const created = createMap(element, startCenter);
      mapInstanceRef.current = created;
      setMap(created);
    } catch (error) {
      console.error("Error during map initialization:", error);
      setMapError("Failed to initialize map");
    }
  }, [startCenter]);

  // Keep the map sized to its container, including after layout shifts
  // right after the page first renders.
  useEffect(() => {
    if (!map) return;
    const resize = () => map.invalidateSize(true);
    const timers = [100, 500, 1000].map((delay) => setTimeout(resize, delay));
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      timers.forEach(clearTimeout);
    };
  }, [map]);

  // Follow the user's location when it changes.
  useEffect(() => {
    map?.setView(userLocation, map.getZoom());
  }, [map, userLocation]);

  const moveTo = (location: LatLon) => {
    saveLocation(location);
    setUserLocation(location);
  };

  const locateUser = () => {
    if (!navigator.geolocation) {
      toast({ variant: "destructive", title: "Location unavailable", description: "This browser cannot share its location." });
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsLocating(false);
        moveTo([position.coords.latitude, position.coords.longitude]);
        toast({ title: "Location accessed", description: "Using your current location for routes." });
      },
      (error) => {
        setIsLocating(false);
        console.error("Location permission error:", error);
        toast({ variant: "destructive", title: "Location access denied", description: "Routes will start from the map's current location." });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const drawRoute = (target: L.Map, points: LatLon[]) => {
    routeLayerRef.current?.remove();
    const endpoint = (pos: LatLon, color: string, label: string) =>
      L.circleMarker(pos, { radius: 9, color: '#ffffff', weight: 3, fillColor: color, fillOpacity: 1 })
        .bindTooltip(label, { permanent: true, direction: 'top', offset: [0, -10] });
    const line = L.polyline(points, { color: '#0000FF', weight: 9, opacity: 0.9 });
    // Mark where the route starts and ends so its direction is clear.
    routeLayerRef.current = L.layerGroup([
      line,
      endpoint(points[0], '#16a34a', 'Start'),
      endpoint(points[points.length - 1], '#dc2626', 'End'),
    ]).addTo(target);
    target.fitBounds(line.getBounds(), { padding: [100, 100] });
  };

  const calculateRoute = async () => {
    const target = mapInstanceRef.current;
    const params = routeQuery({ destination, source, destinationCoords, sourceCoords, userLocation });
    if (!target || !params) return;
    setIsRouting(true);

    try {
      const response = await fetch(apiUrl(`/safe_path?${params.toString()}`));
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Failed to fetch route');

      const points: LatLon[] = (data.route ?? []).map((coord: LatLon) => [coord[0], coord[1]]);
      if (points.length === 0) throw new Error("Empty route");
      if (mapInstanceRef.current === target) drawRoute(target, points);

      const summary: RouteSummary | undefined = data.summary;
      if (summary && typeof summary.distance_m === 'number') {
        const km = (summary.distance_m / 1000).toFixed(1);
        const avoided = Math.round((summary.exposure_reduction ?? 0) * 100);
        toast({
          title: `Safer ${summary.period} route, ${km} km`,
          description: avoided > 0
            ? `Passes ${avoided}% less reported crime than the shortest path, which is ${(summary.shortest_distance_m / 1000).toFixed(1)} km.`
            : "This is already the safest reasonable way to walk there.",
        });
      }
    } catch (error) {
      console.error("API fetch error:", error);
      toast({
        variant: "destructive",
        title: "Route calculation failed",
        description: error instanceof Error && error.message !== 'Failed to fetch'
          ? error.message
          : "Could not calculate a safe route. Please try again."
      });
    } finally {
      setIsRouting(false);
    }
  };

  return (
    <div className="w-full h-full flex-grow relative" style={{ minHeight: "500px", height: "calc(100vh - 250px)" }}>
      {isRouting && (
        <div className="absolute inset-0 bg-background/80 z-50 flex items-center justify-center">
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            <p className="mt-4 text-sm text-muted-foreground">Finding a safer route...</p>
          </div>
        </div>
      )}

      <div className="w-full h-full flex flex-col">
        {mapError ? (
          <div className="w-full h-full rounded-lg border-2 border-dashed border-muted-foreground/50 flex flex-col items-center justify-center p-6">
            <div className="mb-4 text-destructive">
              <AlertTriangle size={32} />
            </div>
            <h3 className="text-lg font-medium mb-2">{mapError}</h3>
            <p className="text-sm text-muted-foreground text-center mb-4">
              Please try reloading the map.
            </p>
            <Button onClick={() => setMapError(null)}>Reload Map</Button>
          </div>
        ) : (
          <div
            ref={attachMap}
            className="w-full h-full rounded-lg"
            style={{ minHeight: "500px" }}
            id="map-container"
          />
        )}
      </div>

      {map && (
        <Button
          variant="secondary"
          size="icon"
          className="absolute top-24 right-3 z-[1000] shadow"
          onClick={locateUser}
          disabled={isLocating}
          aria-label="Use my location"
          title="Use my location"
        >
          <Locate className={isLocating ? "animate-pulse" : undefined} />
        </Button>
      )}

      <DestinationInput
        destination={destination}
        setDestination={setDestination}
        source={source}
        setSource={setSource}
        setSourceCoords={setSourceCoords}
        setDestinationCoords={setDestinationCoords}
        onCalculateRoute={calculateRoute}
        isLoading={isRouting}
      />

      {map && (
        <MapMarker position={userLocation} map={map} isUser={true} popup="Your Location" />
      )}

      {showHeatmap && map && (
        <HeatmapLayer centerCoords={userLocation} map={map} />
      )}
    </div>
  );
};

export default LeafletMap;
