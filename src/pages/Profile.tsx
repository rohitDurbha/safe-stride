
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateUserProfile } from '@/api/auth';
import { errorMessage } from '@/lib/errors';
import { readStoredUser } from '@/lib/storedUser';
import { toast } from "@/hooks/use-toast";
import { UserRound, Home, Navigation } from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";

const Profile = () => {
  const navigate = useNavigate();
  const [storedUser] = useState(() => readStoredUser());
  const [email, setEmail] = useState(storedUser?.email || '');
  const [contactName, setContactName] = useState(storedUser?.emergency_contact?.name || '');
  const [contactEmail, setContactEmail] = useState(storedUser?.emergency_contact?.email || '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updateStatus, setUpdateStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!storedUser && !localStorage.getItem('token')) {
      navigate('/login');
    }
  }, [storedUser, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setUpdateStatus(null);

    try {
      const result = await updateUserProfile(email, contactName, contactEmail);
      
      // Check if this was a local-only update due to network/CORS issues
      if (result.localOnly) {
        setUpdateStatus("Profile updated locally. Changes will be visible on this device but may not sync with the server.");
        toast({
          title: "Profile Updated Locally",
          description: "Your profile has been updated on this device, but we couldn't connect to the server.",
          variant: "default",
        });
      } else {
        setUpdateStatus("Profile updated successfully!");
        toast({
          title: "Profile Updated",
          description: "Your profile has been successfully updated.",
        });
      }
      
      // Re-fetch from localStorage to ensure UI is in sync
      const user = readStoredUser();
      if (user) {
        setEmail(user.email || '');
        setContactName(user.emergency_contact?.name || '');
        setContactEmail(user.emergency_contact?.email || '');
      }
    } catch (error: unknown) {
      console.error("Profile update error:", error);
      const message = errorMessage(error, "Failed to update profile");
      
      setError(message);
      
      toast({
        title: "Update Failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col p-4">
      <div className="w-full max-w-md mx-auto mb-6">
        <NavigationMenu>
          <NavigationMenuList>
            <NavigationMenuItem>
              <NavigationMenuTrigger>Navigation</NavigationMenuTrigger>
              <NavigationMenuContent>
                <div className="grid gap-3 p-4 w-[200px]">
                  <Link to="/home" className="flex items-center gap-2 p-2 hover:bg-accent rounded-md">
                    <Home className="h-4 w-4" />
                    <span>Home</span>
                  </Link>
                  <Link to="/heatmap" className="flex items-center gap-2 p-2 hover:bg-accent rounded-md">
                    <Navigation className="h-4 w-4" />
                    <span>Heatmap</span>
                  </Link>
                </div>
              </NavigationMenuContent>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4 max-w-md mx-auto w-full">
          <AlertTitle>Update Failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      {updateStatus && !error && (
        <Alert className="mb-4 max-w-md mx-auto w-full">
          <AlertTitle>Status</AlertTitle>
          <AlertDescription>{updateStatus}</AlertDescription>
        </Alert>
      )}
      
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <UserRound className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-2xl text-center">Profile Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="contactName">Emergency Contact Name</Label>
              <Input
                id="contactName"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="contactEmail">Emergency Contact Email</Label>
              <Input
                id="contactEmail"
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                required
              />
            </div>
            
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 rounded-full border-2 border-current border-r-transparent animate-spin" />
                  Updating...
                </span>
              ) : (
                "Update Profile"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Profile;
