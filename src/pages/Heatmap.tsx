
import React, { useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import MapView from '@/components/MapView';
import { useNavigate } from 'react-router';
import { ArrowLeft, Map } from "lucide-react";

const Heatmap = () => {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Force a resize event after the component mounts
  useEffect(() => {
    const resizeTimer = setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 500);
    return () => clearTimeout(resizeTimer);
  }, []);
  
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b py-4 px-4">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigate('/home')}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-1">
              <Map className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-bold">Safety Heatmap</h1>
            </div>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <div className="flex-1 container mx-auto p-4 h-full" style={{ minHeight: "calc(100vh - 100px)" }}>
        <div className="mb-4">
          <p className="text-sm text-muted-foreground">
            Viewing crime hotspots in a 20 mile radius of your location.
            Red areas indicate higher concentrations of reported incidents.
          </p>
        </div>
        
        <div 
          ref={containerRef}
          className="h-full flex flex-col bg-background" 
          style={{ 
            minHeight: "calc(100vh - 200px)",
            display: "flex",
            flexDirection: "column"
          }}
        >
          <MapView showHeatmap={true} />
        </div>
      </div>
    </div>
  );
};

export default Heatmap;
