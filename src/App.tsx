import React from 'react';
import { Toaster } from "@/components/ui/toaster";
import { BrowserRouter } from "react-router";
import AppRoutes from "./routes";

const App = () => {
  return (
    <React.StrictMode>
      <Toaster />
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </React.StrictMode>
  );
};

export default App;
