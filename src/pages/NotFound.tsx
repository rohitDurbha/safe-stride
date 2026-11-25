import { useLocation } from "react-router";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <main className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-background px-6">
      <div className="dot-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black_10%,transparent_65%)]" />
      <div className="relative text-center animate-fade-up">
        <p className="text-[72px] font-semibold leading-none tracking-tighter">404</p>
        <p className="mt-3 text-[17px] text-muted-foreground">Oops! Page not found</p>
        <a
          href="/"
          className="press mt-8 inline-flex h-12 items-center rounded-full bg-foreground px-6 text-[15px] font-medium text-background"
        >
          Back to the map
        </a>
      </div>
    </main>
  );
};

export default NotFound;
