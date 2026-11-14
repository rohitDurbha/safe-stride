import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { testBackendConnectivity } from "@/api/api-test";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle2 } from "lucide-react";

// This page automatically redirects to the appropriate page
const Index = () => {
  const navigate = useNavigate();
  const [backendStatus, setBackendStatus] = useState<{
    checking: boolean;
    isConnected: boolean | null;
    error: any | null;
  }>({
    checking: true,
    isConnected: null,
    error: null
  });

  useEffect(() => {
    // First check backend connectivity
    const checkBackend = async () => {
      try {
        const status = await testBackendConnectivity();
        setBackendStatus({
          checking: false,
          isConnected: status.isConnected,
          error: status.error || null
        });
        
        // Only proceed with auth check if backend is connected
        if (status.isConnected) {
          // Check if user is already authenticated
          const user = localStorage.getItem('safeStrideUser');
          
          // If authenticated, go to home page
          if (user) {
            navigate('/home');
          } else {
            // Otherwise go to login page
            navigate('/login');
          }
        }
      } catch (e) {
        setBackendStatus({
          checking: false,
          isConnected: false,
          error: e
        });
      }
    };
    
    checkBackend();
  }, [navigate]);

  const retryConnection = () => {
    setBackendStatus({
      checking: true,
      isConnected: null,
      error: null
    });
    // Re-run the effect
    testBackendConnectivity().then(status => {
      setBackendStatus({
        checking: false,
        isConnected: status.isConnected,
        error: status.error || null
      });
      
      if (status.isConnected) {
        const user = localStorage.getItem('safeStrideUser');
        if (user) {
          navigate('/home');
        } else {
          navigate('/login');
        }
      }
    });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Safe Stride</h1>
          <p className="text-muted-foreground">Navigate safely with real-time safety data</p>
        </div>
        
        {backendStatus.checking && (
          <div className="text-center space-y-4">
            <div className="animate-pulse">
              <div className="h-8 w-8 mx-auto rounded-full border-2 border-primary border-r-transparent animate-spin"></div>
            </div>
            <p>Verifying backend connectivity...</p>
          </div>
        )}
        
        {!backendStatus.checking && backendStatus.isConnected === false && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Backend Connection Failed</AlertTitle>
            <AlertDescription className="space-y-4">
              <p>Could not connect to the backend server at: <code className="bg-muted p-1 rounded">{import.meta.env.VITE_API_URL || "http://127.0.0.1:5000"}</code></p>
              <p>Please ensure your Flask backend is running on port 5000.</p>
              <div className="flex justify-center mt-4">
                <Button onClick={retryConnection}>
                  Retry Connection
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}
        
        {!backendStatus.checking && backendStatus.isConnected === true && (
          <Alert className="border-green-500 mb-4">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <AlertTitle className="text-green-700">Backend Connected</AlertTitle>
            <AlertDescription>
              Successfully connected to the backend. Redirecting...
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
};

export default Index;
