import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router";
import AppRoutes, { APP_ROUTES } from "./routes";

// The real pages pull in Leaflet and Firebase, which need a browser, so each
// one is replaced by a stub that only prints its name.
const stubPage = vi.hoisted(
  () => (name: string) => ({ default: () => <main>{`${name} page`}</main> }),
);
vi.mock("./pages/Index", () => stubPage("Index"));
vi.mock("./pages/Login", () => stubPage("Login"));
vi.mock("./pages/Home", () => stubPage("Home"));
vi.mock("./pages/Setup", () => stubPage("Setup"));
vi.mock("./pages/Heatmap", () => stubPage("Heatmap"));
vi.mock("./pages/Profile", () => stubPage("Profile"));

const render = (path: string) =>
  renderToString(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  );

describe("app routes", () => {
  it("keeps every page path the app links to", () => {
    expect(APP_ROUTES.map((route) => route.path)).toEqual([
      "/",
      "/login",
      "/home",
      "/setup",
      "/heatmap",
      "/profile",
      "*",
    ]);
  });

  it.each([
    ["/", "Index"],
    ["/login", "Login"],
    ["/home", "Home"],
    ["/setup", "Setup"],
    ["/heatmap", "Heatmap"],
    ["/profile", "Profile"],
  ])("renders %s with the %s page", (path, name) => {
    expect(render(path)).toContain(`${name} page`);
  });

  it("shows the not found page for an unknown path", () => {
    expect(render("/no-such-page")).toContain("Oops! Page not found");
  });

  it("links the not found page back to the start page", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(render("/missing")).toMatch(/<a[^>]+href="\/"/);
  });
});
