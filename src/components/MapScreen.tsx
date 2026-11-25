import React, { useCallback, useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Layers, LocateFixed, Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { apiUrl, readToken } from '@/lib/api';
import { LatLon, initialLocation, routeQuery, saveLocation } from '@/lib/mapSetup';
import type { RouteSummary } from '@/lib/routeSummary';
import { clearSession, displayName, fetchProfile, saveSession } from '@/lib/session';
import { readStoredUser, type StoredUser } from '@/lib/storedUser';
import { useColorScheme } from '@/lib/theme';
import { cn } from '@/lib/utils';
import AccountButton from './map/AccountButton';
import BottomSheet from './map/BottomSheet';
import HeatmapLayer from './map/HeatmapLayer';
import MapMarker from './map/MapMarker';
import { createMap, createTiles, routeBounds, routeLayer } from './map/mapLayers';
import { ReportBody, ReportHeader } from './map/ReportPanel';
import { ExploreBody, ExploreHeader, RouteBody, RouteHeader, RoutingBody, RoutingHeader } from './map/RoutePanels';
import SearchPanel, { DirectionsValue } from './map/SearchPanel';

interface MapScreenProps {
  initialHeatmap?: boolean;
}

interface FoundRoute {
  points: LatLon[];
  summary: RouteSummary;
}

const EMPTY_DIRECTIONS: DirectionsValue = {
  source: '',
  destination: '',
  sourceCoords: null,
  destinationCoords: null,
  period: 'auto',
};

const isDesktop = () => typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches;

const MapScreen: React.FC<MapScreenProps> = ({ initialHeatmap = false }) => {
  const scheme = useColorScheme();
  const mapInstanceRef = useRef<L.Map | null>(null);
  const [map, setMap] = useState<L.Map | null>(null);

  const [userLocation, setUserLocation] = useState<LatLon>(() => initialLocation());
  const [startCenter] = useState<LatLon>(userLocation);
  const [user, setUser] = useState<StoredUser | null>(() => readStoredUser());
  const [hour] = useState(() => new Date().getHours());

  const [directions, setDirections] = useState<DirectionsValue>(EMPTY_DIRECTIONS);
  const [editing, setEditing] = useState(false);
  const [route, setRoute] = useState<FoundRoute | null>(null);
  const [isRouting, setIsRouting] = useState(false);
  const [panel, setPanel] = useState<'explore' | 'report'>('explore');
  const [showHeatmap, setShowHeatmap] = useState(initialHeatmap);
  const [sheetCollapsed, setSheetCollapsed] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  // The map lives exactly as long as its container element.
  const attachMap = useCallback((element: HTMLDivElement | null) => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
      setMap(null);
    }
    if (!element) return;
    const created = createMap(element, startCenter);
    created.attributionControl.setPosition('topright');
    mapInstanceRef.current = created;
    setMap(created);
  }, [startCenter]);

  // CARTO's grey basemaps (or greyed OpenStreetMap tiles without a key),
  // swapped when the system switches between light and dark.
  useEffect(() => {
    if (!map) return;
    const tiles = createTiles(scheme).addTo(map);
    return () => {
      tiles.remove();
    };
  }, [map, scheme]);

  // Keep the map sized to the window, including mobile browser bars.
  useEffect(() => {
    if (!map) return;
    const resize = () => map.invalidateSize();
    const timer = setTimeout(resize, 150);
    window.addEventListener('resize', resize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', resize);
    };
  }, [map]);

  // Draw the route in the current theme's colours.
  useEffect(() => {
    if (!map || !route) return;
    const layer = routeLayer(route.points).addTo(map);
    return () => {
      layer.remove();
    };
  }, [map, route, scheme]);

  // Frame a new route so it is not hidden behind the panels. The zoom starts
  // after the route card has painted, so the two never share a frame.
  useEffect(() => {
    if (!map || !route) return;
    const desktop = isDesktop();
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        // A plain pan and zoom. flyToBounds zooms out and back in, which loads
        // three sets of tiles and stutters on slower phones.
        map.fitBounds(routeBounds(route.points), {
          paddingTopLeft: desktop ? [460, 60] : [40, 140],
          paddingBottomRight: desktop ? [80, 60] : [40, Math.round(window.innerHeight * 0.56) + 24],
          maxZoom: 17,
          animate: true,
        });
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [map, route]);

  // Refresh the account details, which also checks that the token still works.
  useEffect(() => {
    const token = readToken();
    if (!token) return;
    let active = true;
    fetchProfile(token)
      .then((profile) => {
        if (!active) return;
        if (profile) {
          saveSession(token, profile);
          setUser(profile);
        } else {
          clearSession();
          setUser(null);
        }
      })
      .catch(() => {
        // Offline. Keep the cached account.
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setEditing(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const locateUser = () => {
    if (!navigator.geolocation) {
      toast({ variant: 'destructive', title: 'Location unavailable', description: 'This browser cannot share its location.' });
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsLocating(false);
        const here: LatLon = [position.coords.latitude, position.coords.longitude];
        saveLocation(here);
        setUserLocation(here);
        mapInstanceRef.current?.setView(here, Math.max(mapInstanceRef.current.getZoom(), 16), { animate: true });
      },
      () => {
        setIsLocating(false);
        toast({ variant: 'destructive', title: 'Location access denied', description: 'Routes will start from downtown Oakland instead.' });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
  };

  const findRoute = async () => {
    const params = routeQuery({
      ...directions,
      userLocation,
      period: directions.period === 'auto' ? null : directions.period,
    });
    if (!params) return;
    setIsRouting(true);
    setEditing(false);
    setPanel('explore');
    setSheetCollapsed(false);

    try {
      const response = await fetch(apiUrl(`/safe_path?${params.toString()}`));
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Failed to fetch route');
      const points: LatLon[] = (data.route ?? []).map((c: LatLon) => [c[0], c[1]]);
      if (points.length < 2) throw new Error('No walkable route was found between those places.');
      setRoute({ points, summary: data.summary });
    } catch (error) {
      console.error('Route error:', error);
      setEditing(true);
      toast({
        variant: 'destructive',
        title: 'No route found',
        description: error instanceof Error && error.message !== 'Failed to fetch'
          ? error.message
          : 'Could not reach the route service. Please try again.',
      });
    } finally {
      setIsRouting(false);
    }
  };

  const clearRoute = () => {
    setRoute(null);
    setDirections(EMPTY_DIRECTIONS);
    setEditing(false);
  };

  const searchMode = editing ? 'edit' : route || isRouting ? 'route' : 'pill';

  let sheetHeader: React.ReactNode;
  let sheetBody: React.ReactNode;
  if (isRouting) {
    sheetHeader = <RoutingHeader />;
    sheetBody = <RoutingBody />;
  } else if (route) {
    sheetHeader = <RouteHeader summary={route.summary} />;
    sheetBody = <RouteBody summary={route.summary} onEdit={() => setEditing(true)} onClear={clearRoute} />;
  } else if (panel === 'report') {
    sheetHeader = <ReportHeader onBack={() => setPanel('explore')} />;
    sheetBody = <ReportBody user={user} fallbackLocation={userLocation} />;
  } else {
    sheetHeader = <ExploreHeader name={displayName(user).split(' ')[0]} hour={hour} />;
    sheetBody = (
      <ExploreBody
        showHeatmap={showHeatmap}
        onToggleHeatmap={() => setShowHeatmap((v) => !v)}
        onReport={() => { setPanel('report'); setSheetCollapsed(false); }}
        onLocate={locateUser}
        isLocating={isLocating}
      />
    );
  }

  const mapButtons = (
    <>
      <FabButton label={showHeatmap ? 'Hide heatmap' : 'Show heatmap'} active={showHeatmap} onClick={() => setShowHeatmap((v) => !v)}>
        <Layers />
      </FabButton>
      <FabButton label="Show my location" onClick={locateUser}>
        <LocateFixed className={cn(isLocating && 'animate-pulse')} />
      </FabButton>
    </>
  );

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-muted">
      <div ref={attachMap} id="map-container" className="absolute inset-0 z-0" aria-label="Map" />

      {map && <MapMarker position={userLocation} map={map} />}
      {map && showHeatmap && <HeatmapLayer map={map} scheme={scheme} />}

      {/* Search on top and the panel below it. On phones these split to the top and bottom edges. */}
      <div className="contents md:pointer-events-none md:absolute md:bottom-4 md:left-4 md:top-4 md:z-[1000] md:flex md:w-[400px] md:flex-col md:gap-3">
        <div className="pointer-events-auto fixed inset-x-3 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[1200] md:static">
          <SearchPanel
            mode={searchMode}
            value={directions}
            onChange={setDirections}
            onOpen={() => setEditing(true)}
            onClose={() => setEditing(false)}
            onClear={clearRoute}
            onSubmit={findRoute}
            isRouting={isRouting}
            accessory={<AccountButton user={user} />}
          />
        </div>

        {!editing && (
          <BottomSheet
            contentKey={isRouting ? 'routing' : route ? 'route' : panel}
            header={sheetHeader}
            collapsed={sheetCollapsed}
            onCollapsedChange={setSheetCollapsed}
            fab={mapButtons}
            className="md:flex md:min-h-0 md:flex-col"
          >
            {sheetBody}
          </BottomSheet>
        )}
      </div>

      {/* Map buttons for larger screens. Phones get them above the sheet. */}
      <div className="absolute bottom-6 right-4 z-[1000] hidden flex-col gap-2 md:flex">
        {mapButtons}
        <div className="surface mt-2 flex flex-col overflow-hidden rounded-full">
          <button type="button" aria-label="Zoom in" onClick={() => map?.zoomIn()} className="grid h-12 w-12 place-items-center transition-colors hover:bg-accent">
            <Plus className="h-5 w-5" />
          </button>
          <div className="mx-3 h-px bg-border" />
          <button type="button" aria-label="Zoom out" onClick={() => map?.zoomOut()} className="grid h-12 w-12 place-items-center transition-colors hover:bg-accent">
            <Minus className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

const FabButton = ({ label, active, onClick, children }: { label: string; active?: boolean; onClick: () => void; children: React.ReactNode }) => (
  <Button
    variant="ghost"
    size="fab"
    aria-label={label}
    title={label}
    aria-pressed={active}
    onClick={onClick}
    className={cn('surface pointer-events-auto', active ? '!bg-foreground !text-background' : 'hover:bg-card')}
  >
    {children}
  </Button>
);

export default MapScreen;
