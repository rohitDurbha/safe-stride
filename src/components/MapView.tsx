
import React, { useState } from 'react';
import LeafletMap from './LeafletMap';
import ViewToggle from './map/ViewToggle';

interface MapViewProps {
  showHeatmap?: boolean;
}

const MapView: React.FC<MapViewProps> = ({ showHeatmap: initialShowHeatmap }) => {
  const [showHeatmap, setShowHeatmap] = useState(initialShowHeatmap ?? false);
  const [lastPropHeatmap, setLastPropHeatmap] = useState(initialShowHeatmap);
  // When the parent passes a new showHeatmap value, adopt it during render
  // rather than from an effect, so the map never paints the stale view first.
  if (initialShowHeatmap !== lastPropHeatmap) {
    setLastPropHeatmap(initialShowHeatmap);
    if (initialShowHeatmap !== undefined) {
      setShowHeatmap(initialShowHeatmap);
    }
  }

  return (
    <div
      className="relative w-full h-full flex flex-col bg-background" 
      style={{ minHeight: "600px", height: "calc(100vh - 200px)" }}
      id="map-view-container"
    >
      <LeafletMap showHeatmap={showHeatmap} />
      <ViewToggle showHeatmap={showHeatmap} onToggle={setShowHeatmap} />
    </div>
  );
};

export default MapView;
