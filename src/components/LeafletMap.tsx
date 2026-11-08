import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { AlertTriangle, Locate } from 'lucide-react';
import { Button } from '@/components/ui/button';
import DestinationInput, { LatLon } from './map/DestinationInput';
import MapMarker from './map/MapMarker';
import HeatmapLayer from './map/HeatmapLayer';
import { toast } from '@/components/ui/use-toast';

interface LeafletMapProps {
  showHeatmap?: boolean;
  isMounted?: boolean;
  containerRef?: React.RefObject<HTMLDivElement>;
}

const LOCATION_STORAGE_KEY = 'safeStride_userLocation';
const LOCATION_PROMPTED_KEY = 'safeStride_locationPrompted';

const LeafletMap: React.FC<LeafletMapProps> = ({ 
  showHeatmap = false, 
  isMounted = false,
  containerRef
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(() => {
    const storedLocation = localStorage.getItem(LOCATION_STORAGE_KEY);
    return storedLocation ? JSON.parse(storedLocation) : null;
  });
  const [destination, setDestination] = useState<string>("");
  const [source, setSource] = useState<string>("");
  const [sourceCoords, setSourceCoords] = useState<LatLon | null>(null);
  const [destinationCoords, setDestinationCoords] = useState<LatLon | null>(null);
  const endpointMarkersRef = useRef<L.LayerGroup | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [routeLine, setRouteLine] = useState<L.Polyline | null>(null);
  const [isMapInitialized, setIsMapInitialized] = useState(false);
  const [locationPermissionStatus, setLocationPermissionStatus] = useState<'prompt' | 'granted' | 'denied' | 'unavailable'>(
    () => {
      if (localStorage.getItem(LOCATION_PROMPTED_KEY)) {
        return localStorage.getItem(LOCATION_STORAGE_KEY) ? 'granted' : 'denied';
      }
      return 'prompt';
    }
  );
  const [mapReady, setMapReady] = useState(false);
  const mapContainerMounted = useRef(false);
  const initAttempts = useRef(0);
  const markerAttempts = useRef(0);

  useEffect(() => {
    console.log("Map component rendering, checking for map container");
    
    const checkMapContainer = () => {
      if (mapRef.current) {
        console.log("Map container exists on initial render");
        mapContainerMounted.current = true;
        setMapReady(true);
        return true;
      }
      return false;
    };
    
    if (!checkMapContainer() && containerRef?.current) {
      console.log("Using parent container reference for map initialization");
      mapContainerMounted.current = true;
      setMapReady(true);
    } else if (!checkMapContainer()) {
      console.log("Map container doesn't exist yet, will check again");
      
      const checkInterval = setInterval(() => {
        initAttempts.current += 1;
        console.log(`Checking map container reference (attempt ${initAttempts.current}):`, mapRef.current);
        
        if (checkMapContainer() || (containerRef?.current && containerRef.current.offsetHeight > 0)) {
          console.log("Map container found!");
          clearInterval(checkInterval);
          mapContainerMounted.current = true;
          setMapReady(true);
        } else if (initAttempts.current >= 5) {
          console.error("Failed to find map container after multiple attempts");
          clearInterval(checkInterval);
          setMapError("Could not initialize map container");
          setIsLoading(false);
        }
      }, 1000);
      
      return () => clearInterval(checkInterval);
    }
  }, [containerRef]);
  
  useEffect(() => {
    if (isMounted && !mapContainerMounted.current && 
        ((mapRef.current && mapRef.current.offsetHeight > 0) || 
         (containerRef?.current && containerRef.current.offsetHeight > 0))) {
      console.log("Parent reports mounted, container exists now");
      mapContainerMounted.current = true;
      setMapReady(true);
    }
  }, [isMounted, containerRef]);

  useEffect(() => {
    if (!mapReady) return;
    
    const defaultLocation: [number, number] = [37.8044, -122.2711];
    console.log("Initializing map with default location:", defaultLocation);
    
    localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(defaultLocation));
    setUserLocation(defaultLocation);
    initializeMap(defaultLocation[0], defaultLocation[1]);
    setLocationPermissionStatus('granted');
  }, [mapReady]);

  const requestLocationPermission = () => {
    setIsLoading(true);
    console.log("Requesting location permission...");
    
    localStorage.setItem(LOCATION_PROMPTED_KEY, 'true');
    
    if (!navigator.geolocation) {
      console.error("Geolocation is not supported by your browser");
      setLocationPermissionStatus('unavailable');
      setMapError("Geolocation is not supported by your browser");
      setIsLoading(false);
      
      const defaultLocation: [number, number] = [37.8044, -122.2711];
      localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(defaultLocation));
      setUserLocation(defaultLocation);
      initializeMap(defaultLocation[0], defaultLocation[1]);
      return;
    }
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        console.log("Location permission granted:", position.coords);
        const newLocation: [number, number] = [position.coords.latitude, position.coords.longitude];
        
        localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(newLocation));
        
        setLocationPermissionStatus('granted');
        setUserLocation(newLocation);
        initializeMap(newLocation[0], newLocation[1]);
        
        toast({
          title: "Location accessed",
          description: "Using your current location for mapping.",
        });
      },
      (error) => {
        console.error("Location permission error:", error);
        setLocationPermissionStatus('denied');
        
        const defaultLocation: [number, number] = [37.8044, -122.2711];
        localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(defaultLocation));
        setUserLocation(defaultLocation);
        initializeMap(defaultLocation[0], defaultLocation[1]);
        
        toast({
          variant: "destructive",
          title: "Location access denied",
          description: "Using default location for mapping.",
        });
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  };

  const initializeMap = (latitude: number, longitude: number) => {
    console.log("Initializing map with coordinates:", latitude, longitude);
    
    try {
      const mapContainer = mapRef.current || (containerRef && containerRef.current);
      
      if (!mapContainer) {
        console.error("Map container reference is not available");
        setMapError("Map container not available");
        setIsLoading(false);
        return;
      }
      
      if (mapInstanceRef.current) {
        console.log("Removing existing map instance");
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      
      console.log("Creating map instance with container:", mapContainer);
      
      if (mapContainer.style.height === '') {
        mapContainer.style.height = '500px';
      }
      
      setTimeout(() => {
        try {
          const map = L.map(mapContainer, {
            attributionControl: true,
            zoomControl: false,
            doubleClickZoom: true,
            scrollWheelZoom: true,
            dragging: true,
          }).setView([latitude, longitude], 14);
          
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19
          }).addTo(map);
          
          L.control.zoom({
            position: 'topright'
          }).addTo(map);
          
          mapInstanceRef.current = map;
          
          if (!document.getElementById('leaflet-styles')) {
            const style = document.createElement('style');
            style.id = 'leaflet-styles';
            style.innerHTML = `
              .user-marker {
                background-color: transparent;
              }
              .pulse {
                border-radius: 50%;
                height: 14px;
                width: 14px;
                background: rgba(51, 195, 240, 1);
                border: 3px solid rgba(255, 255, 255, 0.8);
                box-shadow: 0 0 0 rgba(51, 195, 240, 0.4);
                animation: pulse 2s infinite;
              }
              @keyframes pulse {
                0% {
                  box-shadow: 0 0 0 0 rgba(51, 195, 240, 0.4);
                }
                70% {
                  box-shadow: 0 0 0 10px rgba(51, 195, 240, 0);
                }
                100% {
                  box-shadow: 0 0 0 0 rgba(51, 195, 240, 0);
                }
              }
            `;
            document.head.appendChild(style);
          }
          
          setMapError(null);
          
          const resizeIntervals = [100, 500, 1000, 2000];
          resizeIntervals.forEach(delay => {
            setTimeout(() => {
              if (mapInstanceRef.current) {
                console.log(`Invalidating map size after ${delay}ms`);
                mapInstanceRef.current.invalidateSize(true);
              }
            }, delay);
          });
          
          setIsMapInitialized(true);
          console.log("Map successfully initialized");
          
        } catch (error) {
          console.error("Error during map initialization:", error);
          setMapError("Failed to initialize map: " + String(error));
        } finally {
          setIsLoading(false);
        }
      }, 200);
      
    } catch (error) {
      console.error("Map initialization error:", error);
      setMapError("Failed to initialize map. Please try again later.");
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const handleResize = () => {
      if (mapInstanceRef.current && isMapInitialized) {
        console.log("Window resized, invalidating map size");
        mapInstanceRef.current.invalidateSize(true);
      }
    };

    window.addEventListener('resize', handleResize);
    
    const resizeTimer = setTimeout(() => {
      handleResize();
    }, 1000);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimer);
    };
  }, [isMapInitialized]);

  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        console.log("Cleaning up map instance on unmount");
        try {
          if (routeLine && mapInstanceRef.current && mapInstanceRef.current.hasLayer(routeLine)) {
            mapInstanceRef.current.removeLayer(routeLine);
          }
          mapInstanceRef.current.remove();
          mapInstanceRef.current = null;
          setIsMapInitialized(false);
        } catch (error) {
          console.error("Error cleaning up map:", error);
        }
      }
    };
  }, []);

  const reloadMap = () => {
    console.log("Reloading map");
    setIsLoading(true);
    setMapError(null);
    
    if (locationPermissionStatus === 'granted' && userLocation) {
      initializeMap(userLocation[0], userLocation[1]);
    } else {
      requestLocationPermission();
    }
  };

  const calculateRoute = async () => {
    if (!mapInstanceRef.current || !destination.trim()) return;
    // The typed starting point wins. Your own location is only the
    // fallback when the starting point is left empty.
    if (!source.trim() && !userLocation) return;
    setIsLoading(true);

    const params = new URLSearchParams({ destination: destination.trim() });
    if (destinationCoords) {
      params.set('end_lat', String(destinationCoords[0]));
      params.set('end_lon', String(destinationCoords[1]));
    }
    if (sourceCoords) {
      params.set('start_lat', String(sourceCoords[0]));
      params.set('start_lon', String(sourceCoords[1]));
    } else if (source.trim()) {
      params.set('source', source.trim());
    } else if (userLocation) {
      params.set('start_lat', String(userLocation[0]));
      params.set('start_lon', String(userLocation[1]));
    }

    try {
      const response = await fetch(`http://127.0.0.1:5000/safe_path?${params.toString()}`);
      const data = await response.json().catch(() => ({}));

      if (!response.ok) throw new Error(data.error || 'Failed to fetch route');
      console.log("Fetched data:", data);
  
      const listOfCoords: L.LatLngExpression[] = data.route.map(
        (coord: [number, number]) => [coord[0], coord[1]]
      );
  
      if (listOfCoords.length === 0) throw new Error("Empty route");
  
      if (routeLine && mapInstanceRef.current) {
        mapInstanceRef.current.removeLayer(routeLine);
      }
  
      if (mapInstanceRef.current) {
        const newLine = L.polyline(listOfCoords, {
          color: '#0000FF',
          weight: 9,
          opacity: 0.9
        }).addTo(mapInstanceRef.current);
    
        mapInstanceRef.current.fitBounds(newLine.getBounds(), {
          padding: [100, 100]
        });
    
        setRouteLine(newLine);

        // Mark where the route starts and ends so its direction is clear
        endpointMarkersRef.current?.remove();
        const first = listOfCoords[0] as [number, number];
        const last = listOfCoords[listOfCoords.length - 1] as [number, number];
        const endpoint = (pos: [number, number], color: string, label: string) =>
          L.circleMarker(pos, { radius: 9, color: '#ffffff', weight: 3, fillColor: color, fillOpacity: 1 })
            .bindTooltip(label, { permanent: true, direction: 'top', offset: [0, -10] });
        endpointMarkersRef.current = L.layerGroup([
          endpoint(first, '#16a34a', 'Start'),
          endpoint(last, '#dc2626', 'End'),
        ]).addTo(mapInstanceRef.current);
      }

      const summary = data.summary;
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
    }
  
    setIsLoading(false);
  };

  const renderLocationRequest = () => {
    return (
      <div className="w-full h-full rounded-lg border-2 border-dashed border-muted-foreground/50 flex flex-col items-center justify-center p-6">
        <div className="mb-4 text-primary">
          <Locate size={32} />
        </div>
        <h3 className="text-lg font-medium mb-2">Location Access Required</h3>
        <p className="text-sm text-muted-foreground text-center mb-4">
          Safe Stride needs your location to show you the safest routes and nearby incidents.
        </p>
        <Button onClick={requestLocationPermission} className="mb-2">
          Share My Location
        </Button>
        <Button
          variant="ghost" 
          onClick={() => {
            const defaultLocation: [number, number] = [37.8044, -122.2711];
            localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(defaultLocation));
            localStorage.setItem(LOCATION_PROMPTED_KEY, 'true');
            setUserLocation(defaultLocation);
            setLocationPermissionStatus('granted');
            initializeMap(defaultLocation[0], defaultLocation[1]);
          }}
        >
          Use Default Location
        </Button>
      </div>
    );
  };

  const renderMapError = () => {
    return (
      <div className="w-full h-full rounded-lg border-2 border-dashed border-muted-foreground/50 flex flex-col items-center justify-center p-6">
        <div className="mb-4 text-destructive">
          <AlertTriangle size={32} />
        </div>
        <h3 className="text-lg font-medium mb-2">{mapError}</h3>
        <p className="text-sm text-muted-foreground text-center mb-4">
          Please check your location permissions or try reloading the page.
        </p>
        <Button onClick={reloadMap}>
          Reload Map
        </Button>
      </div>
    );
  };

  const renderMap = () => {
    if (locationPermissionStatus === 'prompt' && !userLocation) {
      return renderLocationRequest();
    }
    
    if (mapError) {
      return renderMapError();
    }

    return (
      <div 
        ref={mapRef} 
        className="w-full h-full rounded-lg"
        style={{ minHeight: "500px" }} 
        id="map-container"
      />
    );
  };

  const isMapReadyForMarkers = () => {
    return isMapInitialized && 
           mapInstanceRef.current && 
           mapInstanceRef.current._container && 
           mapInstanceRef.current._loaded;
  };

  return (
    <div className="w-full h-full flex-grow relative" style={{ minHeight: "500px", height: "calc(100vh - 250px)" }}>
      {isLoading && (
        <div className="absolute inset-0 bg-background/80 z-50 flex items-center justify-center">
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            <p className="mt-4 text-sm text-muted-foreground">Loading map...</p>
          </div>
        </div>
      )}
      
      <div className="w-full h-full flex flex-col">
        {renderMap()}
      </div>
      
      <DestinationInput
        destination={destination}
        setDestination={setDestination}
        source={source}
        setSource={setSource}
        setSourceCoords={setSourceCoords}
        setDestinationCoords={setDestinationCoords}
        onCalculateRoute={calculateRoute}
        isLoading={isLoading}
      />

      {isMapReadyForMarkers() && userLocation && (
        <MapMarker
          position={userLocation}
          map={mapInstanceRef.current}
          isUser={true}
          popup="Your Location"
        />
      )}

      {showHeatmap && isMapReadyForMarkers() && userLocation && (
        <HeatmapLayer
          centerCoords={userLocation}
          map={mapInstanceRef.current}
        />
      )}
    </div>
  );
};

export default LeafletMap;
