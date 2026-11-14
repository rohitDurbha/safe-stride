
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Navigation } from "lucide-react";
import { registerUser, loginUser, onAuthChanged } from '@/api/auth';
import { toast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [locationPermission, setLocationPermission] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [networkError, setNetworkError] = useState<boolean>(false);

  useEffect(() => {
    const user = localStorage.getItem('safeStrideUser');
    if (user) {
      navigate('/home');
    }
  }, [navigate]);

  const handleRequestLocation = () => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        console.log("Location access granted:", position.coords);
        setLocationPermission(true);
        if (localStorage.getItem('safeStrideUser')) {
          navigate('/home');
        }
      },
      (error) => {
        console.error("Location access denied:", error);
        setLocationPermission(false);
      }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setNetworkError(false);

    try {
      if (isSignUp) {
        try {
          await registerUser(email, password, name, contactName, contactEmail);
          localStorage.setItem('safeStrideUser', JSON.stringify({
            email,
            name: name || email.split('@')[0],
            emergency_contact: { name: contactName, email: contactEmail }
          }));
          if (locationPermission === null) {
            handleRequestLocation();
          } else {
            navigate('/home');
          }
        } catch (err: any) {
          console.error('Signup error:', err);
          
          if (err.message && err.message.includes('User already exists')) {
            toast({
              title: "Account already exists",
              description: "This email is already registered. Please try logging in instead.",
              variant: "destructive",
            });
            setError('This email address is already registered. Please log in instead.');
            setTimeout(() => {
              setIsSignUp(false);
            }, 2000);
          } else if (err.message === "Failed to fetch") {
            setNetworkError(true);
            setError("Network error: Cannot connect to the server. Please check your internet connection.");
            toast({
              title: "Network Error",
              description: "Cannot connect to the server. Please check your internet connection.",
              variant: "destructive",
            });
          } else {
            toast({
              title: "Signup failed",
              description: err.message || "Could not create your account. Please try again.",
              variant: "destructive",
            });
            setError(err.message || "Signup failed. Please try again.");
          }
        }
      } else {
        try {
          await loginUser(email, password);
          localStorage.setItem('safeStrideUser', JSON.stringify({
            email,
            name: email.split('@')[0],
            emergency_contact: { name: contactName, email: contactEmail }
          }));
          if (locationPermission === null) {
            handleRequestLocation();
          } else {
            navigate('/home');
          }
        } catch (err: any) {
          console.error('Login error:', err);
          
          if (err.message === "Failed to fetch") {
            setNetworkError(true);
            setError("Network error: Cannot connect to the server. Please check your internet connection.");
            toast({
              title: "Network Error",
              description: "Cannot connect to the server. Please check your internet connection.",
              variant: "destructive",
            });
          } else {
            toast({
              title: "Login failed",
              description: "Invalid email or password. Please check your credentials.",
              variant: "destructive",
            });
            setError('Invalid email or password. Please check your credentials.');
          }
        }
      }
    } catch (err: any) {
      console.error('Authentication error:', err);
      toast({
        title: "Authentication error",
        description: err.message || "An unexpected error occurred",
        variant: "destructive",
      });
      setError(err.message || 'Authentication failed. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-muted p-4">
      <Card className="w-full max-w-md p-6 shadow-lg">
        <div className="space-y-6">
          <div className="text-center">
            <div className="flex justify-center mb-2">
              <Navigation className="h-12 w-12 text-primary" />
            </div>
            <h1 className="text-3xl font-bold">Safe Stride</h1>
            <p className="text-muted-foreground mt-2">Navigate safely with real-time safety data</p>
          </div>
          
          {error && !networkError && (
            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
              {error}
            </div>
          )}
          
          {networkError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Network Error</AlertTitle>
              <AlertDescription>
                Cannot connect to the server. Please check your internet connection or try again later.
              </AlertDescription>
            </Alert>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    placeholder="Your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactName">Emergency Contact Name</Label>
                  <Input
                    id="contactName"
                    placeholder="Contact person's name"
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
                    placeholder="contact.email@example.com"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    required
                  />
                </div>
              </>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="your.email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            
            <div className="pt-2">
              <Button
                type="submit"
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 rounded-full border-2 border-current border-r-transparent animate-spin" />
                    {isSignUp ? "Creating account..." : "Signing in..."}
                  </span>
                ) : (
                  isSignUp ? "Create Account" : "Sign In"
                )}
              </Button>
            </div>
          </form>
          
          <div className="text-center">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError(null); // Clear errors when switching modes
              }}
              className="text-sm underline text-primary hover:text-primary/80"
            >
              {isSignUp ? "Already have an account? Sign in" : "Don't have an account? Sign up"}
            </button>
          </div>
          
          {locationPermission === false && (
            <div className="text-sm text-destructive text-center">
              <p>Location access is required for this app to work properly.</p>
              <button
                type="button"
                onClick={handleRequestLocation}
                className="underline mt-1"
              >
                Grant location access
              </button>
            </div>
          )}
        </div>
      </Card>
      
      <p className="mt-8 text-sm text-center text-muted-foreground">
        Safe Stride helps you choose the safest walking routes<br />
        using real-time safety data.
      </p>
    </div>
  );
};

export default Login;
