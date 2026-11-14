
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/use-toast";
import { configManager } from '@/firebase/config';
import { ArrowLeft } from "lucide-react";

const SetupPage = () => {
  const navigate = useNavigate();
  const [firebaseConfig, setFirebaseConfig] = useState(() => configManager.getConfig());
  const [mapboxToken, setMapboxToken] = useState(() => localStorage.getItem('mapbox_token') || '');

  const handleSaveFirebase = () => {
    configManager.setConfig(firebaseConfig);
    toast({
      title: "Firebase configuration saved",
      description: "You'll need to refresh the application for changes to take effect.",
    });
  };

  const handleSaveMapbox = () => {
    localStorage.setItem('mapbox_token', mapboxToken);
    toast({
      title: "Mapbox token saved",
      description: "The map will use this token the next time it initializes.",
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b py-4 px-4">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold">API Configuration</h1>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <div className="flex-1 container mx-auto p-4 max-w-3xl">
        <Tabs defaultValue="firebase">
          <TabsList className="grid grid-cols-2 mb-4">
            <TabsTrigger value="firebase">Firebase Config</TabsTrigger>
            <TabsTrigger value="mapbox">Mapbox Token</TabsTrigger>
          </TabsList>
          
          <TabsContent value="firebase">
            <Card>
              <CardHeader>
                <CardTitle>Firebase Configuration</CardTitle>
                <CardDescription>
                  Enter your Firebase project credentials here. You can find these in your Firebase project settings.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="apiKey">API Key</Label>
                  <Input
                    id="apiKey"
                    value={firebaseConfig.apiKey}
                    onChange={(e) => setFirebaseConfig({...firebaseConfig, apiKey: e.target.value})}
                    placeholder="Your Firebase API Key"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="authDomain">Auth Domain</Label>
                  <Input
                    id="authDomain"
                    value={firebaseConfig.authDomain}
                    onChange={(e) => setFirebaseConfig({...firebaseConfig, authDomain: e.target.value})}
                    placeholder="yourproject.firebaseapp.com"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="projectId">Project ID</Label>
                  <Input
                    id="projectId"
                    value={firebaseConfig.projectId}
                    onChange={(e) => setFirebaseConfig({...firebaseConfig, projectId: e.target.value})}
                    placeholder="your-project-id"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="storageBucket">Storage Bucket</Label>
                  <Input
                    id="storageBucket"
                    value={firebaseConfig.storageBucket}
                    onChange={(e) => setFirebaseConfig({...firebaseConfig, storageBucket: e.target.value})}
                    placeholder="yourproject.appspot.com"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="messagingSenderId">Messaging Sender ID</Label>
                  <Input
                    id="messagingSenderId"
                    value={firebaseConfig.messagingSenderId}
                    onChange={(e) => setFirebaseConfig({...firebaseConfig, messagingSenderId: e.target.value})}
                    placeholder="123456789012"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="appId">App ID</Label>
                  <Input
                    id="appId"
                    value={firebaseConfig.appId}
                    onChange={(e) => setFirebaseConfig({...firebaseConfig, appId: e.target.value})}
                    placeholder="1:123456789012:web:abc123def456"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="measurementId">Measurement ID (Optional)</Label>
                  <Input
                    id="measurementId"
                    value={firebaseConfig.measurementId}
                    onChange={(e) => setFirebaseConfig({...firebaseConfig, measurementId: e.target.value})}
                    placeholder="G-ABCDEF1234"
                  />
                </div>
              </CardContent>
              <CardFooter>
                <Button onClick={handleSaveFirebase}>Save Firebase Config</Button>
              </CardFooter>
            </Card>
          </TabsContent>
          
          <TabsContent value="mapbox">
            <Card>
              <CardHeader>
                <CardTitle>Mapbox Access Token</CardTitle>
                <CardDescription>
                  Enter your Mapbox public access token. You can create or find your tokens in the 
                  <a href="https://account.mapbox.com/access-tokens/" target="_blank" rel="noreferrer" className="underline ml-1">
                    Mapbox account dashboard
                  </a>.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label htmlFor="mapboxToken">Public Access Token</Label>
                  <Input
                    id="mapboxToken"
                    value={mapboxToken}
                    onChange={(e) => setMapboxToken(e.target.value)}
                    placeholder="pk.eyJ1Ijoie3VzZXJuYW1lfSIsImEiOiJ..."
                  />
                </div>
              </CardContent>
              <CardFooter>
                <Button onClick={handleSaveMapbox}>Save Mapbox Token</Button>
              </CardFooter>
            </Card>
          </TabsContent>
        </Tabs>
        
        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground mb-4">
            After saving your configuration, you may need to refresh the application for all changes to take effect.
          </p>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Refresh Application
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SetupPage;
