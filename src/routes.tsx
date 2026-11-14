import { Route, Routes } from "react-router";
import Login from "./pages/Login";
import Home from "./pages/Home";
import NotFound from "./pages/NotFound";
import SetupPage from "./pages/Setup";
import Index from "./pages/Index";
import Heatmap from "./pages/Heatmap";
import Profile from "./pages/Profile";

export const APP_ROUTES = [
  { path: "/", element: <Index /> },
  { path: "/login", element: <Login /> },
  { path: "/home", element: <Home /> },
  { path: "/setup", element: <SetupPage /> },
  { path: "/heatmap", element: <Heatmap /> },
  { path: "/profile", element: <Profile /> },
  { path: "*", element: <NotFound /> },
];

const AppRoutes = () => (
  <Routes>
    {APP_ROUTES.map(({ path, element }) => (
      <Route key={path} path={path} element={element} />
    ))}
  </Routes>
);

export default AppRoutes;
