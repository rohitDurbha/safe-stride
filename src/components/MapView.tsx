
import React, { useState, useEffect, useRef } from 'react';
import LeafletMap from './LeafletMap';
import ViewToggle from './map/ViewToggle';

interface MapViewProps {
  showHeatmap?: boolean;
}

const MapView: React.FC<MapViewProps> = ({ showHeatmap: initialShowHeatmap }) => {
  const [showHeatmap, setShowHeatmap] = useState(initialShowHeatmap ?? false);
  const [lastPropHeatmap, setLastPropHeatmap] = useState(initialShowHeatmap);
  const [mapMounted, setMapMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // When the parent passes a new showHeatmap value, adopt it during render
  // rather than from an effect, so the map never paints the stale view first.
  if (initialShowHeatmap !== lastPropHeatmap) {
    setLastPropHeatmap(initialShowHeatmap);
    if (initialShowHeatmap !== undefined) {
      setShowHeatmap(initialShowHeatmap);
    }
  }

  useEffect(() => {
    // Mark component as mounted after a short delay to ensure DOM is ready
    const timer = setTimeout(() => {
      setMapMounted(true);

      // Dispatch resize event when component mounts to ensure proper dimensions
      window.dispatchEvent(new Event('resize'));
    }, 500);

    return () => {
      clearTimeout(timer);
      setMapMounted(false);
    };
  }, []);

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-full flex flex-col bg-background" 
      style={{ minHeight: "600px", height: "calc(100vh - 200px)" }}
      id="map-view-container"
    >
      <LeafletMap 
        showHeatmap={showHeatmap} 
        isMounted={mapMounted} 
        containerRef={containerRef} 
      />
      <ViewToggle showHeatmap={showHeatmap} onToggle={setShowHeatmap} />
    </div>
  );
};

export default MapView;
