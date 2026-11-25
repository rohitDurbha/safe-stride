import { useSyncExternalStore } from "react";

export type ColorScheme = "light" | "dark";

const DARK_QUERY = "(prefers-color-scheme: dark)";

function media(): MediaQueryList | null {
  try {
    return typeof window === "undefined" || !window.matchMedia ? null : window.matchMedia(DARK_QUERY);
  } catch {
    return null;
  }
}

export function currentScheme(): ColorScheme {
  return media()?.matches ? "dark" : "light";
}

export function subscribeScheme(onChange: () => void): () => void {
  const mql = media();
  if (!mql) return () => {};
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

/** The system colour scheme, updated live when the user switches it. */
export function useColorScheme(): ColorScheme {
  return useSyncExternalStore(subscribeScheme, currentScheme, () => "light");
}

/** Keep the dark class on <html> in step with the system setting. */
export function syncDocumentScheme(root: HTMLElement = document.documentElement): () => void {
  const apply = () => root.classList.toggle("dark", currentScheme() === "dark");
  apply();
  return subscribeScheme(apply);
}

/** Read an HSL token such as --route from the stylesheet as a CSS colour. */
export function cssColor(token: string, fallback = "#111111", root: Element = document.documentElement): string {
  try {
    const value = getComputedStyle(root).getPropertyValue(token).trim();
    return value ? `hsl(${value})` : fallback;
  } catch {
    return fallback;
  }
}
